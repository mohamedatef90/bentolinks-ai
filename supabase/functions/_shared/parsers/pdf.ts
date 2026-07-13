// PDF parser: download (20MB cap), extract the text layer with unpdf; if the
// text layer is missing/thin (scanned PDFs), fall back to Gemini Files API
// multimodal extraction.

import { extractText, getDocumentProxy, getMeta } from 'npm:unpdf@0.12';
import { extractPdfViaGemini } from '../gemini.ts';
import { ParsedContent, PARSER_UA, wordCount } from './types.ts';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MIN_TEXT_LAYER_CHARS = 500;

async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > cap) throw new Error(`PDF exceeds ${cap / 1024 / 1024}MB cap`);
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error(`PDF exceeds ${cap / 1024 / 1024}MB cap`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function parsePdf(url: string, geminiKey: string | null): Promise<ParsedContent> {
  const res = await fetch(url, {
    headers: { 'User-Agent': PARSER_UA, Accept: 'application/pdf,*/*' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_PDF_BYTES) {
    await res.body?.cancel();
    throw new Error(`PDF exceeds ${MAX_PDF_BYTES / 1024 / 1024}MB cap`);
  }
  const bytes = await readCapped(res, MAX_PDF_BYTES);

  let text: string | null = null;
  let title: string | null = null;
  let author: string | null = null;
  let pages: number | null = null;
  let textSource: string | null = null;

  try {
    const doc = await getDocumentProxy(bytes);
    const extracted = await extractText(doc, { mergePages: true });
    pages = extracted.totalPages ?? null;
    const merged = (extracted.text ?? '').replace(/\s+\n/g, '\n').trim();
    if (merged.length >= MIN_TEXT_LAYER_CHARS) {
      text = merged;
      textSource = 'text-layer';
    }
    try {
      const meta = await getMeta(doc);
      title = (meta?.info?.Title as string)?.trim() || null;
      author = (meta?.info?.Author as string)?.trim() || null;
    } catch {
      // metadata is optional
    }
  } catch (e) {
    console.warn(`unpdf extraction failed for ${url}:`, (e as Error).message);
  }

  // Scanned/image PDFs: multimodal extraction.
  if (!text && geminiKey) {
    try {
      text = (await extractPdfViaGemini(geminiKey, bytes)).trim() || null;
      if (text) textSource = 'gemini';
    } catch (e) {
      console.warn(`Gemini PDF extraction failed for ${url}:`, (e as Error).message);
    }
  }

  const host = new URL(res.url).hostname;
  const filename = decodeURIComponent(
    new URL(res.url).pathname.split('/').pop() ?? '',
  ).replace(/\.pdf$/i, '');

  return {
    title: title ?? (filename || null),
    description: null,
    author,
    site_name: host.replace(/^www\./, ''),
    thumbnail_url: null,
    favicon_url: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    published_at: null,
    content_text: text,
    word_count: wordCount(text),
    duration_seconds: null,
    raw_metadata: { pages, bytes: bytes.byteLength, text_source: textSource },
  };
}
