// Facebook parser via the Apify "facebook-posts-scraper" actor
// (apify~facebook-posts-scraper). Facebook hard-blocks direct server fetches
// (share/... URLs return HTTP 400), so real content requires the paid Apify
// actor (APIFY_TOKEN in Vault). The actor resolves share/r|p|v wrappers to the
// underlying post and returns the caption + author + timestamp. Facebook does
// not expose a downloadable video URL or (usually) a transcript, so — unlike
// reels — this relies on the post caption, which is the reliable content.
//
// Without APIFY_TOKEN this throws and the worker degrades to a metadata stub
// (a generic AI summary inferred from the URL), same as before.

import { ParsedContent, wordCount } from './types.ts';

export interface FacebookKeys {
  apifyToken: string | null;
}

/**
 * Which Facebook URLs are actual posts/reels/videos worth an Apify run — as
 * opposed to tool/nav pages (ads library, business suite, creator tools) where
 * a generic summary is fine and a paid scrape would be wasted.
 */
export function isFacebookContentUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const isFbHost = host === 'facebook.com' || host === 'm.facebook.com' ||
    host === 'web.facebook.com' || host === 'fb.watch' || host === 'fb.com';
  if (!isFbHost) return false;
  if (host === 'fb.watch') return true; // fb.watch is always a video permalink
  const p = u.pathname;
  return (
    /^\/share\/(r|p|v|s)?\/?/i.test(p) ||   // share/r|p|v wrappers (Linkat share sheet)
    /^\/reel\//i.test(p) ||
    /^\/watch\/?/i.test(p) ||
    /\/posts\//i.test(p) ||
    /\/videos\//i.test(p) ||
    /^\/photo/i.test(p) ||
    /^\/permalink\.php/i.test(p) ||
    /^\/story\.php/i.test(p) ||
    /\/groups\/[^/]+\/(posts|permalink)\//i.test(p)
  );
}

/** The post caption. `message` is usually a JSON-encoded {"text","ranges"} string. */
function captionText(message: unknown): string | null {
  if (message == null) return null;
  if (typeof message === 'object') {
    const t = (message as { text?: unknown }).text;
    return typeof t === 'string' && t.trim() ? t.trim() : null;
  }
  if (typeof message === 'string') {
    const s = message.trim();
    if (!s) return null;
    if (s.startsWith('{')) {
      try {
        const obj = JSON.parse(s) as { text?: unknown };
        if (typeof obj.text === 'string') return obj.text.trim() || null;
      } catch { /* not JSON — treat as plain text */ }
    }
    return s;
  }
  return null;
}

export async function parseFacebook(url: string, keys: FacebookKeys): Promise<ParsedContent> {
  if (!keys.apifyToken) {
    throw new Error('NO_SCRAPER_CONFIGURED: set APIFY_TOKEN in Vault for Facebook parsing');
  }

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${keys.apifyToken}&timeout=110`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls: [{ url }], resultsLimit: 1, captionText: true }),
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!res.ok) throw new Error(`Apify facebook-posts-scraper HTTP ${res.status}`);
  const items = await res.json();
  const post = Array.isArray(items) && items.length > 0 ? items[0] : null;
  if (!post) throw new Error('Apify returned no Facebook post');

  const caption = captionText(post.message) ?? captionText(post.translated_message_for_viewer);
  const author: string | null = post.pageName ?? null;

  const sfvc = post.short_form_video_context ?? {};
  const thumbnail: string | null =
    sfvc?.video?.first_frame_thumbnail ??
    post?.attachments?.[0]?.media?.thumbnailImage?.uri ??
    post?.attachments?.[0]?.media?.image?.uri ??
    null;

  const transcriptUrls: unknown =
    post?.attachments?.[0]?.media?.video_delivery_response?.transcript_urls;
  const hasTranscript = Array.isArray(transcriptUrls) && transcriptUrls.length > 0;

  const publishedAt = post.creation_time
    ? new Date(Number(post.creation_time) * 1000).toISOString()
    : null;

  const isVideo = !!post.video || !!post.short_form_video_context;
  const title = caption
    ? caption.split('\n')[0].slice(0, 120)
    : (author ? `Facebook ${isVideo ? 'video' : 'post'} by ${author}` : 'Facebook post');

  return {
    title,
    description: caption?.slice(0, 300) ?? null,
    author,
    site_name: 'Facebook',
    thumbnail_url: thumbnail,
    favicon_url: 'https://www.google.com/s2/favicons?domain=facebook.com&sz=64',
    published_at: publishedAt,
    content_text: caption,
    word_count: wordCount(caption),
    duration_seconds: null,
    raw_metadata: {
      scraper: 'apify',
      fb_page: author,
      fb_post_id: post.post_id ?? post.facebookId ?? null,
      shareable_url: sfvc?.shareable_url ?? post.facebookUrl ?? url,
      is_video: isVideo,
      has_transcript: hasTranscript,
    },
  };
}
