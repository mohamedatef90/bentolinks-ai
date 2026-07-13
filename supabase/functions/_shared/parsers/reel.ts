// Instagram Reels / TikTok parser. These platforms block server-side scraping,
// so full parsing is OPT-IN via a paid scraper key in Supabase Vault:
//   - APIFY_TOKEN      → Apify actors (instagram-scraper / tiktok-scraper)
//   - SCRAPER_API_KEY  → ScraperAPI proxy fetch + OG tag extraction
// With neither secret set this parser throws, and the worker falls back to the
// plain OG/article parse → item lands as status='degraded' (by design).

import { parseHTML } from 'npm:linkedom@0.18';
import { ParsedContent, PARSER_UA, wordCount } from './types.ts';

export interface ScraperKeys {
  apifyToken: string | null;
  scraperApiKey: string | null;
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

async function parseViaApify(url: string, token: string): Promise<ParsedContent> {
  const isTikTok = /tiktok\.com/i.test(url);

  if (isTikTok) {
    const item = await runApifyActor(token, 'clockworks~tiktok-scraper', {
      postURLs: [url],
      resultsPerPage: 1,
    });
    if (!item) throw new Error('Apify returned no TikTok items');
    const caption: string | null = item.text?.trim() || null;
    return {
      title: caption ? caption.slice(0, 120) : `TikTok by @${item.authorMeta?.name ?? 'unknown'}`,
      description: caption?.slice(0, 300) ?? null,
      author: item.authorMeta?.nickName ?? item.authorMeta?.name ?? null,
      site_name: 'TikTok',
      thumbnail_url: item.videoMeta?.coverUrl ?? item.covers?.[0] ?? null,
      favicon_url: 'https://www.google.com/s2/favicons?domain=tiktok.com&sz=64',
      published_at: item.createTimeISO ?? null,
      content_text: caption,
      word_count: wordCount(caption),
      duration_seconds: item.videoMeta?.duration ?? null,
      raw_metadata: { scraper: 'apify', likes: item.diggCount ?? null, plays: item.playCount ?? null },
    };
  }

  const item = await runApifyActor(token, 'apify~instagram-scraper', {
    directUrls: [url],
    resultsType: 'posts',
    resultsLimit: 1,
  });
  if (!item) throw new Error('Apify returned no Instagram items');
  const caption: string | null = item.caption?.trim() || null;
  return {
    title: caption ? caption.slice(0, 120) : `Reel by @${item.ownerUsername ?? 'unknown'}`,
    description: caption?.slice(0, 300) ?? null,
    author: item.ownerFullName ?? item.ownerUsername ?? null,
    site_name: 'Instagram',
    thumbnail_url: item.displayUrl ?? null,
    favicon_url: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64',
    published_at: item.timestamp ?? null,
    content_text: caption,
    word_count: wordCount(caption),
    duration_seconds: item.videoDuration ? Math.round(item.videoDuration) : null,
    raw_metadata: { scraper: 'apify', likes: item.likesCount ?? null, plays: item.videoPlayCount ?? null },
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
  if (keys.apifyToken) return await parseViaApify(url, keys.apifyToken);
  if (keys.scraperApiKey) return await parseViaScraperApi(url, keys.scraperApiKey);
  throw new Error('NO_SCRAPER_CONFIGURED: set APIFY_TOKEN or SCRAPER_API_KEY in Vault for reel parsing');
}
