// Server-side Gemini client (ported from the old client-side services/geminiService.ts,
// which inlined the API key into the public bundle).

const MODEL = 'gemini-2.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface EnrichmentResult {
  summary: string;
  key_points: string[];
  topic_category: string;
  tags: string[];
  content_type_label: string;
  language: string;
  suggested_title: string;
}

const ENRICH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: '2-3 sentence summary of the main point' },
    key_points: { type: 'ARRAY', items: { type: 'STRING' }, description: '3-5 key takeaways' },
    topic_category: {
      type: 'STRING',
      enum: ['AI', 'Design', 'Development', 'Productivity', 'News', 'Lifestyle', 'Science', 'Business', 'Other'],
    },
    tags: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-5 lowercase hyphenated tags' },
    content_type_label: {
      type: 'STRING',
      enum: ['Tutorial', 'News Article', 'Research Paper', 'Tool Review', 'Opinion', 'Case Study', 'Video Essay', 'Social Post', 'Documentation', 'Other'],
    },
    language: { type: 'STRING', description: 'ISO 639-1 code of the content language' },
    suggested_title: { type: 'STRING', description: 'A clean, human-readable title' },
  },
  required: ['summary', 'key_points', 'topic_category', 'tags', 'content_type_label', 'language', 'suggested_title'],
};

async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
  retry = 0,
): Promise<string> {
  const MAX_RETRIES = 3;
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (res.status === 429 || res.status >= 500) {
    await res.body?.cancel();
    if (retry < MAX_RETRIES) {
      await sleep(3000 * (retry + 1));
      return callGemini(apiKey, body, retry + 1);
    }
    throw new Error(`Gemini ${res.status} after ${MAX_RETRIES} retries`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

export async function enrichContent(
  apiKey: string,
  input: { title: string | null; url: string; sourceType: string; content: string },
): Promise<EnrichmentResult> {
  const prompt = `You are a knowledge assistant. Extract structured information from the given content.

Source type: ${input.sourceType}
URL: ${input.url}
Title: ${input.title ?? '(unknown)'}

Content:
${input.content.slice(0, 32000)}

Rules:
- summary: 2-3 sentences capturing the main point, in the content's own language.
- key_points: 3-5 short bullet takeaways.
- tags: 2-5 normalized tags — lowercase, hyphens instead of spaces, max 30 chars each
  (examples: llm, agents, rag, prompt-engineering, ui-design, frontend, open-source, tutorial).
- suggested_title: clean title without site-name suffixes.`;

  const text = await callGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ENRICH_SCHEMA,
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(text) as EnrichmentResult;
  parsed.tags = (parsed.tags ?? [])
    .map((t) => t.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 30))
    .filter(Boolean)
    .slice(0, 5);
  return parsed;
}
