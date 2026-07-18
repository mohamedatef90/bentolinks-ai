// Facebook parser via the Apify "facebook-posts-scraper" actor
// (apify~facebook-posts-scraper). Facebook hard-blocks direct server fetches
// (share/... URLs return HTTP 400), so real content requires the paid Apify
// actor (APIFY_TOKEN in Vault).
//
// The actor returns TWO different shapes depending on the URL:
//   - POST shape  (share/p, /posts/…): a `message` caption + pageName + attachments.
//   - VIDEO shape (share/v, /reel/…, fb.watch): a video-player object with NO
//     `message` — instead `videoDeliveryLegacyFields.browser_native_*_url` (a
//     direct .mp4), `captions_url` (subtitles, when available), pageName, owner,
//     publish_time, preferred_thumbnail, playable_duration_in_ms.
//
// For the video shape we now do what the Instagram/TikTok reel parser does:
// download the (size-capped) clip and have Gemini transcribe the spoken audio,
// or use the subtitle file when Facebook provides one. That upgrades FB reels
// from a caption-less generic summary to real transcribed content.
//
// Without APIFY_TOKEN this throws and the worker degrades to a metadata stub.

import { ParsedContent, wordCount } from './types.ts';
import { transcribeVideoBytes } from '../gemini.ts';

export interface FacebookKeys {
  apifyToken: string | null;
  geminiKey?: string | null;
}

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB cap — keeps the Gemini upload in-budget

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
    /^\/share\/(r|p|v|s)?\/?/i.test(p) ||   // share/r|p|v wrappers (Qlip share sheet)
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

/** Pull the best direct video URL out of either response shape. */
function videoUrlFrom(post: any): string | null {
  const legacy = post?.videoDeliveryLegacyFields ?? {};
  const sfvc = post?.short_form_video_context ?? {};
  // SD first — smaller download, well under the 20MB/upload budget.
  return (
    legacy.browser_native_sd_url ??
    legacy.browser_native_hd_url ??
    sfvc?.video?.playable_url ??
    post?.attachments?.[0]?.media?.playable_url ??
    post?.videoUrl ??
    null
  );
}

/** Download a short clip (size-capped) and have Gemini transcribe the audio. */
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
    console.warn('facebook video transcription failed:', (e as Error).message);
    return null;
  }
}

/** Fetch a WebVTT/SRT subtitle file and strip it down to plain caption text. */
async function fetchCaptions(captionsUrl: string): Promise<string | null> {
  try {
    const res = await fetch(captionsUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) { await res.body?.cancel(); return null; }
    const raw = await res.text();
    const lines = raw.split(/\r?\n/).filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (/^WEBVTT/i.test(t)) return false;
      if (/^\d+$/.test(t)) return false;                       // cue index
      if (/-->/.test(t)) return false;                          // timestamp line
      if (/^(NOTE|STYLE|REGION)\b/i.test(t)) return false;
      return true;
    });
    const text = lines.join(' ').replace(/\s+/g, ' ').trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Merge the creator caption with the transcript / subtitles of the video. */
function mergeCaptionAndTranscript(caption: string | null, transcript: string | null): string | null {
  const parts: string[] = [];
  if (caption) parts.push(caption);
  if (transcript) parts.push(`Spoken content:\n${transcript}`);
  return parts.join('\n\n').trim() || null;
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

  // Caption (post shape). May be absent for pure-video reels.
  const caption = captionText(post.message) ?? captionText(post.translated_message_for_viewer);

  // Video handling (video shape): subtitles first (exact + cheap), else Gemini
  // transcription of the spoken audio — same treatment as Instagram/TikTok reels.
  const videoUrl = videoUrlFrom(post);
  let transcript: string | null = null;
  let transcriptSource: 'captions_file' | 'gemini' | null = null;
  if (typeof post.captions_url === 'string' && post.captions_url) {
    transcript = await fetchCaptions(post.captions_url);
    if (transcript) transcriptSource = 'captions_file';
  }
  if (!transcript && videoUrl && keys.geminiKey) {
    transcript = await transcribeVideo(videoUrl, keys.geminiKey);
    if (transcript) transcriptSource = 'gemini';
  }

  const content = mergeCaptionAndTranscript(caption, transcript);

  const author: string | null =
    post.owner?.name ?? (post.pageName && post.pageName !== 'reel' ? post.pageName : null);

  const sfvc = post.short_form_video_context ?? {};
  const thumbnail: string | null =
    post?.preferred_thumbnail?.image?.uri ??
    sfvc?.video?.first_frame_thumbnail ??
    post?.attachments?.[0]?.media?.thumbnailImage?.uri ??
    post?.attachments?.[0]?.media?.image?.uri ??
    null;

  const ts = post.publish_time ?? post.creation_time;
  const publishedAt = ts ? new Date(Number(ts) * 1000).toISOString() : null;

  const durationSeconds = post.playable_duration_in_ms
    ? Math.round(Number(post.playable_duration_in_ms) / 1000)
    : null;

  const isVideo = !!videoUrl || !!post.video || !!post.short_form_video_context ||
    !!post.videoDeliveryLegacyFields;

  // Title comes from the CAPTION only — never the merged content, so a
  // caption-less video never gets the "Spoken content:" label as its title.
  // With no caption we hand a neutral fallback; enrichment supplies the real
  // AI title from the transcript.
  const title = caption
    ? caption.split('\n')[0].slice(0, 120)
    : (author
        ? `Facebook ${isVideo ? 'video' : 'post'} by ${author}`
        : `Facebook ${isVideo ? 'video' : 'post'}`);

  return {
    title,
    description: (caption ?? transcript)?.slice(0, 300) ?? null,
    author,
    site_name: 'Facebook',
    thumbnail_url: thumbnail,
    favicon_url: 'https://www.google.com/s2/favicons?domain=facebook.com&sz=64',
    published_at: publishedAt,
    content_text: content,
    word_count: wordCount(content),
    duration_seconds: durationSeconds,
    raw_metadata: {
      scraper: 'apify',
      fb_page: author,
      fb_post_id: post.post_id ?? post.facebookId ?? post.videoId ?? null,
      shareable_url: sfvc?.shareable_url ?? post.facebookUrl ?? post.permalink_url ?? url,
      is_video: isVideo,
      video_url: videoUrl,
      transcribed: transcriptSource === 'gemini',
      transcript_source: transcriptSource,
    },
  };
}
