// Pluggable LLM provider for the enrichment step (summary / key points / tags / topic).
// Selected by the Vault secret LLM_PROVIDER (gemini | claude | openai | nvidia);
// defaults to 'gemini' so nothing breaks if it's unset. Embeddings and TTS remain
// Gemini-only (keeping one embedding model avoids re-embedding the corpus).
// Production runs 'nvidia' (z-ai/glm-5.2 on integrate.api.nvidia.com) with
// automatic fallback to Gemini so items never stall on a provider outage.

import { enrichContent as enrichGemini, EnrichmentResult } from './gemini.ts';

export type LlmProvider = 'gemini' | 'claude' | 'openai' | 'nvidia';

export interface EnrichInput {
  title: string | null;
  url: string;
  sourceType: string;
  content: string;
}

export interface ProviderConfig {
  provider: LlmProvider;
  geminiKey: string | null;
  anthropicKey: string | null;
  openaiKey: string | null;
  nvidiaKey: string | null;
  /** Deep/long-form model (Vault LLM_MODEL) — the nvidia router's heavy tier. */
  model: string | null;
  /** Fast/cheap model (Vault LLM_MODEL_FAST) — the nvidia router's light tier. */
  fastModel: string | null;
}

// Two-tier NVIDIA router. Most saves are thin (bookmarks, social posts, short
// pages): a small model answers those in seconds, while GLM-5.2 — which queues
// 1.5-3min on the shared endpoint — is reserved for long-form content that
// actually benefits from a frontier reasoner. Both verified live on the account.
const NVIDIA_DEFAULT_MODEL = 'z-ai/glm-5.2';         // deep tier
const NVIDIA_FAST_MODEL = 'openai/gpt-oss-20b';      // fast tier (clean JSON, reasoning kept out of content)
// Content at/above this many characters routes to the deep model; below it, fast.
const ROUTER_DEEP_CHARS = 2000;

/** Pick the NVIDIA model for this item: fast for thin content, deep for long-form. */
function routeNvidiaModel(cfg: ProviderConfig, input: EnrichInput): string {
  const deep = cfg.model || NVIDIA_DEFAULT_MODEL;
  const fast = cfg.fastModel || NVIDIA_FAST_MODEL;
  return input.content.trim().length >= ROUTER_DEEP_CHARS ? deep : fast;
}

const TOPIC_ENUM = ['AI', 'Design', 'Development', 'Productivity', 'News', 'Lifestyle', 'Science', 'Business', 'Other'];
const LABEL_ENUM = ['Tutorial', 'News Article', 'Research Paper', 'Tool Review', 'Opinion', 'Case Study', 'Video Essay', 'Social Post', 'Documentation', 'Other'];

// Standard JSON Schema (used by Claude tool-use and OpenAI structured outputs).
const JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-3 sentence summary of the main point' },
    key_points: { type: 'array', items: { type: 'string' }, description: '3-5 key takeaways' },
    topic_category: { type: 'string', enum: TOPIC_ENUM },
    tags: { type: 'array', items: { type: 'string' }, description: '2-5 lowercase hyphenated tags' },
    content_type_label: { type: 'string', enum: LABEL_ENUM },
    language: { type: 'string', description: 'ISO 639-1 code of the content language' },
    suggested_title: { type: 'string', description: 'A clean, human-readable title' },
  },
  required: ['summary', 'key_points', 'topic_category', 'tags', 'content_type_label', 'language', 'suggested_title'],
  additionalProperties: false,
} as const;

function buildPrompt(input: EnrichInput): string {
  // Metadata-only items (plain bookmarks, un-scrapable social links) still get
  // enriched: the model describes the destination from URL + title + snippet.
  const thin = input.content.trim().length < 200;
  return `You are a knowledge assistant. Extract structured information from the given content.

Source type: ${input.sourceType}
URL: ${input.url}
Title: ${input.title ?? '(unknown)'}

Content:
${input.content.slice(0, 32000) || '(no content could be extracted)'}

Rules:
- summary: 2-3 sentences capturing the main point, in the content's own language.
- key_points: 3-5 short bullet takeaways.
- tags: 2-5 normalized tags — lowercase, hyphens instead of spaces, max 30 chars each.
- suggested_title: clean title without site-name suffixes.${thin ? `
- Only minimal metadata is available for this link. Infer from the URL, domain and title what the page or site is and what it offers, and write the summary as a useful description of that destination. Never answer that there is no content.` : ''}`;
}

/** Shared post-processing so every provider yields identical, normalized output. */
function normalize(raw: Partial<EnrichmentResult>): EnrichmentResult {
  return {
    summary: raw.summary ?? '',
    key_points: Array.isArray(raw.key_points) ? raw.key_points.slice(0, 5) : [],
    topic_category: TOPIC_ENUM.includes(raw.topic_category as string) ? raw.topic_category! : 'Other',
    tags: (raw.tags ?? [])
      .map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-').slice(0, 30))
      .filter(Boolean)
      .slice(0, 5),
    content_type_label: LABEL_ENUM.includes(raw.content_type_label as string) ? raw.content_type_label! : 'Other',
    language: raw.language ?? 'en',
    suggested_title: raw.suggested_title ?? (raw.summary ? raw.summary.slice(0, 80) : ''),
  };
}

// Anthropic Claude — structured output via forced tool use.
async function enrichClaude(apiKey: string, input: EnrichInput): Promise<EnrichmentResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      tools: [{ name: 'extract', description: 'Return the structured enrichment.', input_schema: JSON_SCHEMA }],
      tool_choice: { type: 'tool', name: 'extract' },
      messages: [{ role: 'user', content: buildPrompt(input) }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const block = (json?.content ?? []).find((b: any) => b.type === 'tool_use');
  if (!block?.input) throw new Error('Claude returned no tool_use output');
  return normalize(block.input as Partial<EnrichmentResult>);
}

// NVIDIA (integrate.api.nvidia.com, OpenAI-compatible) — z-ai/glm-5.2 by default.
// Tries strict json_schema first; NIM structured-output support varies per model,
// so a 4xx retries once with json_object + the schema embedded in the prompt.
async function enrichNvidia(apiKey: string, model: string | null, input: EnrichInput): Promise<EnrichmentResult> {
  const call = async (responseFormat: Record<string, unknown>, schemaInPrompt: boolean) => {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || NVIDIA_DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: schemaInPrompt
              ? `You are a knowledge assistant. Respond with ONLY a JSON object matching this JSON Schema, no prose:\n${JSON.stringify(JSON_SCHEMA)}`
              : 'You are a knowledge assistant. Respond only via the provided schema.',
          },
          { role: 'user', content: buildPrompt(input) },
        ],
        response_format: responseFormat,
      }),
      // NVIDIA's shared endpoint queues big models — observed 1.5-3min latency
      // for GLM-5.2. 140s is the edge of the worker isolate's wall clock; if the
      // isolate dies mid-job, reclaim_stuck_jobs re-queues and Gemini fallback
      // still guarantees the item enriches.
      signal: AbortSignal.timeout(140_000),
    });
    return res;
  };

  let res = await call(
    { type: 'json_schema', json_schema: { name: 'enrichment', strict: true, schema: JSON_SCHEMA } },
    false,
  );
  if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
    res = await call({ type: 'json_object' }, true);
  }
  if (!res.ok) throw new Error(`NVIDIA error ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  let text: string | undefined = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('NVIDIA returned no content');
  // GLM occasionally wraps JSON in markdown fences despite response_format.
  text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return normalize(JSON.parse(text) as Partial<EnrichmentResult>);
}

// OpenAI — structured output via response_format json_schema.
async function enrichOpenAI(apiKey: string, input: EnrichInput): Promise<EnrichmentResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a knowledge assistant. Respond only via the provided schema.' },
        { role: 'user', content: buildPrompt(input) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'enrichment', strict: true, schema: JSON_SCHEMA },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned no content');
  return normalize(JSON.parse(text) as Partial<EnrichmentResult>);
}

/** EnrichmentResult plus which provider actually produced it (fallbacks included). */
export type EnrichOutcome = EnrichmentResult & { enriched_by: string };

/** Enrich with the configured provider. Throws a clear error if its key is missing. */
export async function enrich(cfg: ProviderConfig, input: EnrichInput): Promise<EnrichOutcome> {
  switch (cfg.provider) {
    case 'nvidia': {
      if (!cfg.nvidiaKey) throw new Error('LLM_PROVIDER=nvidia but NVIDIA_API_KEY missing from Vault');
      const model = routeNvidiaModel(cfg, input);
      try {
        const r = await enrichNvidia(cfg.nvidiaKey, model, input);
        return { ...r, enriched_by: `nvidia:${model}` };
      } catch (e) {
        // User-confirmed behavior: never let items stall on a provider outage.
        if (!cfg.geminiKey) throw e;
        console.warn(`NVIDIA enrich (${model}) failed, falling back to Gemini: ${(e as Error).message}`);
        return { ...(await enrichGemini(cfg.geminiKey, input)), enriched_by: 'gemini:fallback' };
      }
    }
    case 'claude':
      if (!cfg.anthropicKey) throw new Error('LLM_PROVIDER=claude but ANTHROPIC_API_KEY missing from Vault');
      return { ...(await enrichClaude(cfg.anthropicKey, input)), enriched_by: 'claude' };
    case 'openai':
      if (!cfg.openaiKey) throw new Error('LLM_PROVIDER=openai but OPENAI_API_KEY missing from Vault');
      return { ...(await enrichOpenAI(cfg.openaiKey, input)), enriched_by: 'openai' };
    case 'gemini':
    default:
      if (!cfg.geminiKey) throw new Error('GEMINI_API_KEY missing from Vault');
      return { ...(await enrichGemini(cfg.geminiKey, input)), enriched_by: 'gemini' };
  }
}
