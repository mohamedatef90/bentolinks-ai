const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'igsh',
  'ref', 'ref_src', 'source', 'share', 's', 'si', 'feature',
]);

export type SourceType =
  | 'article' | 'youtube' | 'reel' | 'tweet' | 'pdf' | 'rss' | 'reddit' | 'podcast' | 'other';

/** Normalize a URL for duplicate detection. */
export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';

  // YouTube: normalize every variant to youtube.com/watch?v=VIDEO_ID
  const ytId = extractYouTubeId(u);
  if (ytId) return `https://youtube.com/watch?v=${ytId}`;

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  let out = u.toString();
  out = out.replace(/\/$/, '').replace(/\?$/, '');
  return out;
}

export function extractYouTubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) return shorts[1];
    const embed = u.pathname.match(/^\/embed\/([\w-]+)/);
    if (embed) return embed[1];
  }
  return null;
}

const DETECTION_RULES: Array<[RegExp, SourceType]> = [
  [/youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\//i, 'youtube'],
  [/instagram\.com\/(reel|reels|p|tv)\//i, 'reel'],
  [/tiktok\.com\/.+\/video\//i, 'reel'],
  [/(twitter|x)\.com\/[^/]+\/status\//i, 'tweet'],
  [/reddit\.com\/r\/[^/]+\/comments\//i, 'reddit'],
  [/\.pdf(\?|#|$)/i, 'pdf'],
];

export function detectSourceType(url: string): SourceType {
  for (const [re, type] of DETECTION_RULES) {
    if (re.test(url)) return type;
  }
  return 'article';
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)|\.(local|internal)$/i;

/** Basic SSRF guard: http(s) only, no private/loopback hosts, length cap. */
export function validatePublicUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  if (raw.length > 2048) return { ok: false, reason: 'URL exceeds 2048 characters' };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'Not a valid URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'Only http/https URLs are accepted' };
  }
  if (PRIVATE_HOST_RE.test(u.hostname)) {
    return { ok: false, reason: 'Private or local addresses are not allowed' };
  }
  return { ok: true, url: u };
}
