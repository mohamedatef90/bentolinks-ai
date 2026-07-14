// Instagram Reels / TikTok parser. These platforms block server-side scraping,
// so full parsing is OPT-IN via a paid scraper key in Supabase Vault:
//   - APIFY_TOKEN      → Apify actors (instagram-scraper / tiktok-scraper)
//   - SCRAPER_API_KEY  → ScraperAPI proxy fetch + OG tag extraction
// With neither secret set this parser throws, and the worker falls back to the
// plain OG/article parse → item lands as status='degraded' (by design).

import { parseHTML } from 'npm:linkedom@0.18';
import { transcribeVideoBytes } from '../gemini.ts';
import { ParsedContent, PARSER_UA, wordCount } from './types.ts';

export interface ScraperKeys {
  apifyToken: string | null;
  scraperApiKey: string | null;
  geminiKey: string | null;
}

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB cap — keeps Gemini upload inside the time budget

/** Download a short video (size-capped) and have Gemini transcribe what's said. */
async function transcribeVideo(videoUrl: string, geminiKey: string): Promise<string | null> {
  try {
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    if (!res.ok) { await res.body?.cancel(); return null; }
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len && len > MAX_VIDEO_BYTES) { await res.body?.cancel(); return null; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_VIDEO_BYTES) return null;
    const mime = res.headers.get('content-type')?.split(';')[0] || 'video/mp4';
    const text = (await transcribeVideoBytes(geminiKey, bytes, mime)).trim();
    return text || null;
  } catch (e) {
    console.warn('reel video transcription failed:', (e as Error).message);
    return null;
  }
}

/** Merge the creator caption with the AI transcript of the spoken audio. */
function mergeCaptionAndTranscript(caption: string | null, transcript: string | null): string | null {
  const parts: string[] = [];
  if (caption) parts.push(caption);
  if (transcript) parts.push(`Spoken content:\n${transcript}`);
  return parts.join('\n\n').trim() || null;
}

async function runApifyActor(
  token: string,
  actor: string,
  input: Record<string, unknown>,
): Promise<any | null> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=90`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(100_000),
    },
  );
  if (!res.ok) throw new Error(`Apify ${actor} HTTP ${res.status}`);
  const items = await res.json();
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

async function parseViaApify(url: string, token: string, geminiKey: string | null): Promise<ParsedContent> {
  const isTikTok = /tiktok\.com/i.test(url);

  if (isTikTok) {
    const item = await runApifyActor(token, 'clockworks~tiktok-scraper', {
      postURLs: [url],
      resultsPerPage: 1,
    });
    if (!item) throw new Error('Apify returned no TikTok items');
    const caption: string | null = item.text?.trim() || null;
    const videoUrl: string | null =
      item.videoMeta?.downloadAddr ?? item.mediaUrls?.[0] ?? item.videoUrl ?? null;
    const transcript = videoUrl && geminiKey ? await transcribeVideo(videoUrl, geminiKey) : null;
    const content = mergeCaptionAndTranscript(caption, transcript);
    return {
      title: caption ? caption.slice(0, 120) : `TikTok by @${item.authorMeta?.name ?? 'unknown'}`,
      description: caption?.slice(0, 300) ?? null,
      author: item.authorMeta?.nickName ?? item.authorMeta?.name ?? null,
      site_name: 'TikTok',
      thumbnail_url: item.videoMeta?.coverUrl ?? item.covers?.[0] ?? null,
      favicon_url: 'https://www.google.com/s2/favicons?domain=tiktok.com&sz=64',
      published_at: item.createTimeISO ?? null,
      content_text: content,
      word_count: wordCount(content),
      duration_seconds: item.videoMeta?.duration ?? null,
      raw_metadata: {
        scraper: 'apify',
        creator_caption: caption,
        video_url: videoUrl,
        transcribed: !!transcript,
        likes: item.diggCount ?? null,
        plays: item.playCount ?? null,
      },
    };
  }

  const item = await runApifyActor(token, 'apify~instagram-scraper', {
    directUrls: [url],
    resultsType: 'posts',
    resultsLimit: 1,
  });
  if (!item) throw new Error('Apify returned no Instagram items');
  const caption: string | null = item.caption?.trim() || null;
  const videoUrl: string | null = item.videoUrl ?? item.videoUrls?.[0]?.url ?? null;
  const transcript = videoUrl && geminiKey ? await transcribeVideo(videoUrl, geminiKey) : null;
  const content = mergeCaptionAndTranscript(caption, transcript);
  return {
    title: caption ? caption.slice(0, 120) : `Reel by @${item.ownerUsername ?? 'unknown'}`,
    description: caption?.slice(0, 300) ?? null,
    author: item.ownerFullName ?? item.ownerUsername ?? null,
    site_name: 'Instagram',
    thumbnail_url: item.displayUrl ?? null,
    favicon_url: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64',
    published_at: item.timestamp ?? null,
    content_text: content,
    word_count: wordCount(content),
    duration_seconds: item.videoDuration ? Math.round(item.videoDuration) : null,
    raw_metadata: {
      scraper: 'apify',
      creator_caption: caption,
      video_url: videoUrl,
      transcribed: !!transcript,
      likes: item.likesCount ?? null,
      plays: item.videoPlayCount ?? null,
    },
  };
}

async function parseViaScraperApi(url: string, apiKey: string): Promise<ParsedContent> {
  const res = await fetch(
    `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`,
    { signal: AbortSignal.timeout(70_000) },
  );
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();
  const { document } = parseHTML(html);
  const og = (prop: string) =>
    document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content')?.trim() || null;

  const description = og('og:description');
  const isTikTok = /tiktok\.com/i.test(url);
  return {
    title: og('og:title'),
    description,
    author: null,
    site_name: isTikTok ? 'TikTok' : 'Instagram',
    thumbnail_url: og('og:image'),
    favicon_url: `https://www.google.com/s2/favicons?domain=${isTikTok ? 'tiktok.com' : 'instagram.com'}&sz=64`,
    published_at: null,
    content_text: description,
    word_count: wordCount(description),
    duration_seconds: null,
    raw_metadata: { scraper: 'scraperapi' },
  };
}

export async function parseReel(url: string, keys: ScraperKeys): Promise<ParsedContent> {
  if (keys.apifyToken) return await parseViaApify(url, keys.apifyToken, keys.geminiKey);
  if (keys.scraperApiKey) return await parseViaScraperApi(url, keys.scraperApiKey);
  throw new Error('NO_SCRAPER_CONFIGURED: set APIFY_TOKEN or SCRAPER_API_KEY in Vault for reel parsing');
}
