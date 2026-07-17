// On-demand translation of an item's AI fields (title / summary / key points /
// body) into a target language — Arabic by default. User-JWT authenticated.
//
// POST { item_id, target_lang?: 'ar' }
//   -> { title, summary, key_points[], body, lang, cached }
//
// Uses the NVIDIA fast model (gpt-oss-20b) with a Gemini fallback, mirroring the
// enrichment router. Results are cached in content_items.raw_metadata.translations
// so re-opening a translated item is instant and free.

import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { serviceClient, getUser, getSecret } from '../_shared/db.ts';

const NVIDIA_FAST_MODEL = 'openai/gpt-oss-20b';
const BODY_CAP = 6000; // chars of content_text to translate (keeps latency/cost sane)

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic (Modern Standard Arabic)',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  tr: 'Turkish',
};

interface Payload {
  title: string | null;
  summary: string | null;
  key_points: string[];
  body: string | null;
}

interface Translated {
  title: string | null;
  summary: string | null;
  key_points: string[];
  body: string | null;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function buildPrompt(langName: string, input: Payload): string {
  return `Translate the fields of the following JSON into ${langName}. Preserve meaning, tone and any technical terms; translate naturally, not word-for-word. Return ONLY a JSON object with exactly these keys: title (string), summary (string), key_points (array of strings), body (string). If a source field is empty, return it empty. No commentary.

${JSON.stringify(input)}`;
}

async function translateNvidia(apiKey: string, model: string, langName: string, input: Payload): Promise<Translated> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: 'You are a professional translator. Respond with only a JSON object.' },
        { role: 'user', content: buildPrompt(langName, input) },
      ],
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`NVIDIA error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('NVIDIA returned no content');
  return JSON.parse(stripFences(text)) as Translated;
}

async function translateGemini(apiKey: string, langName: string, input: Payload): Promise<Translated> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(langName, input) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(stripFences(text)) as Translated;
}

function normalize(t: Partial<Translated>): Translated {
  return {
    title: typeof t.title === 'string' ? t.title : null,
    summary: typeof t.summary === 'string' ? t.summary : null,
    key_points: Array.isArray(t.key_points) ? t.key_points.map(String).slice(0, 8) : [],
    body: typeof t.body === 'string' ? t.body : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

  const user = await getUser(req);
  if (!user) return corsResponse({ error: 'UNAUTHORIZED' }, 401);

  let body: { item_id?: string; target_lang?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'INVALID_REQUEST', message: 'Body must be JSON' }, 400);
  }
  const lang = (body.target_lang || 'ar').toLowerCase();
  const langName = LANG_NAMES[lang] ?? lang;
  if (!body.item_id) return corsResponse({ error: 'INVALID_REQUEST', message: 'item_id required' }, 400);

  const db = serviceClient();
  const { data: item } = await db
    .from('content_items')
    .select('id, title, summary, key_points, content_text, raw_metadata')
    .eq('id', body.item_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!item) return corsResponse({ error: 'NOT_FOUND' }, 404);

  // Cache hit: return the stored translation without another model call.
  const meta = (item.raw_metadata as Record<string, unknown>) ?? {};
  const cache = (meta.translations as Record<string, Translated> | undefined) ?? {};
  if (cache[lang]) return corsResponse({ ...cache[lang], lang, cached: true });

  const input: Payload = {
    title: item.title ?? null,
    summary: item.summary ?? null,
    key_points: (item.key_points as string[]) ?? [],
    body: item.content_text ? String(item.content_text).slice(0, BODY_CAP) : null,
  };
  if (!input.title && !input.summary && input.key_points.length === 0 && !input.body) {
    return corsResponse({ error: 'NOTHING_TO_TRANSLATE', message: 'Item has no text yet' }, 422);
  }

  const nvidiaKey = await getSecret(db, 'NVIDIA_API_KEY');
  const geminiKey = await getSecret(db, 'GEMINI_API_KEY');
  const fastModel = (await getSecret(db, 'LLM_MODEL_FAST')) || NVIDIA_FAST_MODEL;

  let result: Translated;
  try {
    if (!nvidiaKey) throw new Error('NVIDIA_API_KEY missing');
    result = normalize(await translateNvidia(nvidiaKey, fastModel, langName, input));
  } catch (e) {
    if (!geminiKey) return corsResponse({ error: 'TRANSLATE_FAILED', message: (e as Error).message }, 502);
    console.warn(`NVIDIA translate failed, falling back to Gemini: ${(e as Error).message}`);
    try {
      result = normalize(await translateGemini(geminiKey, langName, input));
    } catch (e2) {
      return corsResponse({ error: 'TRANSLATE_FAILED', message: (e2 as Error).message }, 502);
    }
  }

  // Persist to the cache (best-effort — a failed write still returns the result).
  await db
    .from('content_items')
    .update({ raw_metadata: { ...meta, translations: { ...cache, [lang]: result } } })
    .eq('id', item.id);

  return corsResponse({ ...result, lang, cached: false });
});
