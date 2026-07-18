// Server-side Gemini client (ported from the old client-side services/geminiService.ts,
// which inlined the API key into the public bundle).

const MODEL = 'gemini-2.5-flash';
const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIMENSIONS = 768;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FILES_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

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

/** POST to a Gemini endpoint with 429/5xx backoff retry; returns the parsed JSON body. */
async function geminiRequest(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  retry = 0,
): Promise<Record<string, unknown>> {
  const MAX_RETRIES = 3;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 429 || res.status >= 500) {
    await res.body?.cancel();
    if (retry < MAX_RETRIES) {
      await sleep(3000 * (retry + 1));
      return geminiRequest(url, body, timeoutMs, retry + 1);
    }
    throw new Error(`Gemini ${res.status} after ${MAX_RETRIES} retries`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text.slice(0, 500)}`);
  }
  return await res.json();
}

async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<string> {
  const json = await geminiRequest(`${BASE}/${MODEL}:generateContent?key=${apiKey}`, body, timeoutMs);
  const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

export async function enrichContent(
  apiKey: string,
  input: { title: string | null; url: string; sourceType: string; content: string },
): Promise<EnrichmentResult> {
  // Mirrors llm.ts: metadata-only items still get a useful AI title + summary.
  const thin = input.content.trim().length < 200;
  const prompt = `You are a knowledge assistant. Extract structured information from the given content.

Source type: ${input.sourceType}
URL: ${input.url}
Title: ${input.title ?? '(unknown)'}

Content:
${input.content.slice(0, 32000) || '(no content could be extracted)'}

Rules:
- summary: 2-3 sentences capturing the main point, in the content's own language.
- key_points: 3-5 short bullet takeaways.
- tags: 2-5 normalized tags — lowercase, hyphens instead of spaces, max 30 chars each
  (examples: llm, agents, rag, prompt-engineering, ui-design, frontend, open-source, tutorial).
- suggested_title: clean title without site-name suffixes.${thin ? `
- Only minimal metadata is available for this link. Infer from the URL, domain and title what the page or site is and what it offers, and write the summary as a useful description of that destination. Never answer that there is no content.` : ''}`;

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

// Embeddings ------------------------------------------------------------------

/**
 * Embed text with gemini-embedding-001 at 768 dimensions.
 * Values below the model's native 3072 dims are not pre-normalized, so we
 * L2-normalize before storing — required for cosine similarity to be meaningful.
 */
export async function embedText(
  apiKey: string,
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const json = await geminiRequest(
    `${BASE}/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      content: { parts: [{ text: text.slice(0, 8000) }] },
      taskType,
      outputDimensionality: EMBED_DIMENSIONS,
    },
    30_000,
  );
  const values = (json as any)?.embedding?.values as number[] | undefined;
  if (!values || values.length !== EMBED_DIMENSIONS) {
    throw new Error(`Embedding returned ${values?.length ?? 0} dims, expected ${EMBED_DIMENSIONS}`);
  }
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

// Text-to-speech ----------------------------------------------------------------

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * Synthesize one chunk of text to raw PCM (16-bit LE mono, typically 24kHz).
 * The caller concatenates chunk PCM and wraps it in a single WAV header.
 */
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voiceName = 'Kore',
  timeoutMs = 30_000,
): Promise<{ pcm: Uint8Array; sampleRate: number }> {
  const json = await geminiRequest(
    `${BASE}/${TTS_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    },
    timeoutMs,
  );
  const part = (json as any)?.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data as string | undefined;
  if (!b64) throw new Error('Gemini TTS returned no audio');

  // mimeType is e.g. "audio/L16;codec=pcm;rate=24000"
  const mime = String(part.inlineData.mimeType ?? '');
  const sampleRate = Number(mime.match(/rate=(\d+)/)?.[1] ?? 24000);

  const bin = atob(b64);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  return { pcm, sampleRate };
}

// YouTube native ingestion ------------------------------------------------------

/**
 * Have Gemini watch a YouTube video directly (fileData fileUri) and produce a
 * transcript-style digest. EXPENSIVE (~$0.05 per 10-min video) — call only after
 * the free caption endpoints have failed.
 */
export async function transcribeYouTube(apiKey: string, videoUrl: string): Promise<string> {
  const prompt =
    'Watch this video and produce a detailed transcript-style digest of everything said, ' +
    'in the original spoken language. Preserve the order of ideas and include concrete facts, ' +
    'names and numbers. Output plain text only, no timestamps, no commentary.';
  // 90s cap: must abort BEFORE Supabase Edge kills the background isolate, so the
  // caller's try/catch can degrade to metadata instead of leaving the item stuck
  // in 'parsing'. Short videos/Shorts finish inside this; long uncaptioned videos
  // degrade gracefully (the plan's escape hatch is a Vercel fn for heavier jobs).
  return await callGemini(
    apiKey,
    {
      contents: [{ parts: [{ fileData: { fileUri: videoUrl } }, { text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    },
    90_000,
  );
}

// Files API (PDF fallback) --------------------------------------------------------

/** Upload bytes to the Gemini Files API and wait until the file is ACTIVE. */
async function uploadFile(apiKey: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const start = await fetch(`${UPLOAD_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'qlip-upload' } }),
    signal: AbortSignal.timeout(30_000),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new Error(`Files API start failed: HTTP ${start.status}`);

  const finish = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': String(bytes.byteLength),
    },
    body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  if (!finish.ok) throw new Error(`Files API upload failed: HTTP ${finish.status}`);
  const uploaded = await finish.json();
  let file = uploaded?.file;
  if (!file?.uri) throw new Error('Files API returned no file uri');

  for (let i = 0; i < 15 && file.state === 'PROCESSING'; i++) {
    await sleep(2000);
    const res = await fetch(`${FILES_BASE}/${file.name}?key=${apiKey}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) file = await res.json();
  }
  if (file.state === 'FAILED') throw new Error('Files API processing failed');
  return file.uri as string;
}

/**
 * Transcribe a short video's spoken content by uploading the file to Gemini.
 * Used for reels/TikToks (whose speech isn't in a caption). Caller must cap the
 * download size and only pass short clips — EXPENSIVE and time-bounded.
 */
export async function transcribeVideoBytes(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const fileUri = await uploadFile(apiKey, bytes, mimeType);
  const prompt =
    'This is a short social video. Transcribe everything spoken in it, in the original ' +
    'language, and briefly note key on-screen text. Output plain text only — no timestamps, ' +
    'no commentary.';
  return await callGemini(
    apiKey,
    {
      contents: [{ parts: [{ fileData: { fileUri, mimeType } }, { text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    },
    90_000,
  );
}

/** Multimodal text extraction from a PDF the text layer couldn't handle (scans etc.). */
export async function extractPdfViaGemini(apiKey: string, bytes: Uint8Array): Promise<string> {
  const fileUri = await uploadFile(apiKey, bytes, 'application/pdf');
  const prompt =
    'Extract the full text content of this PDF in reading order. ' +
    'Output plain text only — no markdown, no page numbers, no commentary.';
  return await callGemini(
    apiKey,
    {
      contents: [{ parts: [{ fileData: { fileUri, mimeType: 'application/pdf' } }, { text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    },
    120_000,
  );
}
