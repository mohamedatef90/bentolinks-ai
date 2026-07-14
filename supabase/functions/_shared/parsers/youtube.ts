// YouTube parser: free oEmbed metadata, then transcript via YouTube's caption
// endpoints (brittle, best-effort), then Gemini native video ingestion as the
// paid last resort (~$0.05 per 10-min video). Covers watch/short/embed URLs.

import { extractYouTubeId } from '../canonical.ts';
import { transcribeYouTube } from '../gemini.ts';
import { ParsedContent, PARSER_UA, wordCount } from './types.ts';

// Public InnerTube key embedded in every youtube.com page — a client id, not a secret.
const INNERTUBE_WEB_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

async function fetchOEmbed(watchUrl: string): Promise<OEmbed> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { headers: { 'User-Agent': PARSER_UA }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      await res.body?.cancel();
      return {};
    }
    return await res.json();
  } catch {
    return {};
  }
}

/** Join a json3 caption payload ({events: [{segs: [{utf8}]}]}) into plain text. */
function json3ToText(payload: any): string | null {
  const events = payload?.events;
  if (!Array.isArray(events)) return null;
  const text = events
    .flatMap((e: any) => (Array.isArray(e?.segs) ? e.segs.map((s: any) => s?.utf8 ?? '') : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text : null;
}

/** Legacy timedtext endpoint — only serves some manually-captioned videos. */
async function tryTimedText(videoId: string): Promise<string | null> {
  for (const lang of ['en', 'ar']) {
    const res = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`,
      { headers: { 'User-Agent': PARSER_UA }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      await res.body?.cancel();
      continue;
    }
    const body = await res.text();
    if (!body) continue;
    try {
      const text = json3ToText(JSON.parse(body));
      if (text) return text;
    } catch {
      // fall through to next language
    }
  }
  return null;
}

interface InnertubeResult {
  transcript: string | null;
  durationSeconds: number | null;
  title: string | null;
  author: string | null;
  description: string | null;
}

/** InnerTube player endpoint: caption track list + video details. Brittle by nature. */
async function tryInnertube(videoId: string): Promise<InnertubeResult> {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_WEB_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
            androidSdkVersion: 30,
            hl: 'en',
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) throw new Error(`innertube player HTTP ${res.status}`);
  const json = await res.json();

  const details = json?.videoDetails;
  const out: InnertubeResult = {
    transcript: null,
    durationSeconds: Number(details?.lengthSeconds) || null,
    title: details?.title ?? null,
    author: details?.author ?? null,
    description: details?.shortDescription?.slice(0, 500) ?? null,
  };

  const tracks: any[] = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) return out;

  // Prefer manual captions over auto-generated ('asr'), and English within each group.
  const ranked = [...tracks].sort((a, b) => {
    const manual = (t: any) => (t.kind === 'asr' ? 1 : 0);
    const en = (t: any) => (String(t.languageCode ?? '').startsWith('en') ? 0 : 1);
    return manual(a) - manual(b) || en(a) - en(b);
  });
  const baseUrl = ranked[0]?.baseUrl;
  if (!baseUrl) return out;

  const capRes = await fetch(`${baseUrl}&fmt=json3`, {
    headers: { 'User-Agent': PARSER_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!capRes.ok) {
    await capRes.body?.cancel();
    return out;
  }
  try {
    out.transcript = json3ToText(await capRes.json());
  } catch {
    // caption payload unparsable — keep metadata
  }
  return out;
}

export async function parseYouTube(url: string, geminiKey: string | null): Promise<ParsedContent> {
  const id = extractYouTubeId(new URL(url));
  if (!id) throw new Error('Could not extract YouTube video id');
  const watchUrl = `https://youtube.com/watch?v=${id}`;

  const oembed = await fetchOEmbed(watchUrl);

  let transcript: string | null = null;
  let transcriptSource: string | null = null;
  let inner: InnertubeResult = {
    transcript: null, durationSeconds: null, title: null, author: null, description: null,
  };

  try {
    transcript = await tryTimedText(id);
    if (transcript) transcriptSource = 'timedtext';
  } catch (e) {
    console.warn(`timedtext failed for ${id}:`, (e as Error).message);
  }

  try {
    inner = await tryInnertube(id);
    if (!transcript && inner.transcript) {
      transcript = inner.transcript;
      transcriptSource = 'innertube';
    }
  } catch (e) {
    console.warn(`innertube failed for ${id}:`, (e as Error).message);
  }

  // Paid last resort — only when every caption endpoint came up empty.
  if (!transcript && geminiKey) {
    try {
      transcript = (await transcribeYouTube(geminiKey, watchUrl)).trim() || null;
      if (transcript) transcriptSource = 'gemini';
    } catch (e) {
      console.warn(`Gemini YouTube ingestion failed for ${id}:`, (e as Error).message);
    }
  }

  return {
    title: oembed.title ?? inner.title,
    description: inner.description,
    author: oembed.author_name ?? inner.author,
    site_name: 'YouTube',
    thumbnail_url: oembed.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    favicon_url: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
    published_at: null,
    content_text: transcript,
    word_count: wordCount(transcript),
    duration_seconds: inner.durationSeconds,
    raw_metadata: {
      video_id: id,
      transcript_source: transcriptSource,
      video_url: watchUrl,
      embed_url: `https://www.youtube.com/embed/${id}`,
    },
  };
}
