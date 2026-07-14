// Pluggable LLM provider for the enrichment step (summary / key points / tags / topic).
// Selected by the Vault secret LLM_PROVIDER (gemini | claude | openai); defaults to
// 'gemini' so nothing breaks if it's unset. Embeddings and TTS remain Gemini-only
// (Claude has neither; keeping one embedding model avoids re-embedding the corpus).

import { enrichContent as enrichGemini, EnrichmentResult } from './gemini.ts';

export type LlmProvider = 'gemini' | 'claude' | 'openai';

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
  return `You are a knowledge assistant. Extract structured information from the given content.

Source type: ${input.sourceType}
URL: ${input.url}
Title: ${input.title ?? '(unknown)'}

Content:
${input.content.slice(0, 32000)}

Rules:
- summary: 2-3 sentences capturing the main point, in the content's own language.
- key_points: 3-5 short bullet takeaways.
- tags: 2-5 normalized tags — lowercase, hyphens instead of spaces, max 30 chars each.
- suggested_title: clean title without site-name suffixes.`;
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

/** Enrich with the configured provider. Throws a clear error if its key is missing. */
export async function enrich(cfg: ProviderConfig, input: EnrichInput): Promise<EnrichmentResult> {
  switch (cfg.provider) {
    case 'claude':
      if (!cfg.anthropicKey) throw new Error('LLM_PROVIDER=claude but ANTHROPIC_API_KEY missing from Vault');
      return await enrichClaude(cfg.anthropicKey, input);
    case 'openai':
      if (!cfg.openaiKey) throw new Error('LLM_PROVIDER=openai but OPENAI_API_KEY missing from Vault');
      return await enrichOpenAI(cfg.openaiKey, input);
    case 'gemini':
    default:
      if (!cfg.geminiKey) throw new Error('GEMINI_API_KEY missing from Vault');
      return await enrichGemini(cfg.geminiKey, input);
  }
}
