import { parseHTML } from 'npm:linkedom@0.18';
import { Readability } from 'npm:@mozilla/readability@0.5';

export interface ParsedArticle {
  title: string | null;
  description: string | null;
  author: string | null;
  site_name: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  published_at: string | null;
  content_text: string | null;
  word_count: number | null;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 RefVault/1.0';

function meta(document: any, ...selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const val = el?.getAttribute('content') ?? el?.textContent;
    if (val && val.trim()) return val.trim();
  }
  return null;
}

export async function parseArticle(url: string): Promise<ParsedArticle> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('html')) {
    await res.body?.cancel();
    throw new Error(`Not an HTML page (${contentType})`);
  }

  const html = await res.text();
  const { document } = parseHTML(html);

  const og = {
    title: meta(document, 'meta[property="og:title"]', 'meta[name="twitter:title"]', 'title'),
    description: meta(document, 'meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]'),
    image: meta(document, 'meta[property="og:image"]', 'meta[name="twitter:image"]'),
    siteName: meta(document, 'meta[property="og:site_name"]'),
    author: meta(document, 'meta[name="author"]', 'meta[property="article:author"]'),
    published: meta(document, 'meta[property="article:published_time"]', 'meta[name="date"]'),
  };

  let contentText: string | null = null;
  let readabilityTitle: string | null = null;
  try {
    // Readability mutates the DOM, so it runs after metadata extraction.
    const reader = new Readability(document as unknown as Document, { charThreshold: 200 });
    const parsed = reader.parse();
    if (parsed?.textContent && parsed.textContent.trim().length >= 200) {
      contentText = parsed.textContent.replace(/\n{3,}/g, '\n\n').trim();
      readabilityTitle = parsed.title || null;
    }
  } catch (e) {
    console.warn(`Readability failed for ${url}:`, (e as Error).message);
  }

  const resolve = (maybe: string | null): string | null => {
    if (!maybe) return null;
    try {
      return new URL(maybe, res.url).toString();
    } catch {
      return null;
    }
  };

  const host = new URL(res.url).hostname;
  const publishedAt = og.published && !isNaN(Date.parse(og.published))
    ? new Date(og.published).toISOString()
    : null;

  return {
    title: og.title ?? readabilityTitle,
    description: og.description,
    author: og.author,
    site_name: og.siteName ?? host.replace(/^www\./, ''),
    thumbnail_url: resolve(og.image),
    favicon_url: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    published_at: publishedAt,
    content_text: contentText,
    word_count: contentText ? contentText.split(/\s+/).length : null,
  };
}
