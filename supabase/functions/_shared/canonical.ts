import { checkHostname } from './net.ts';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'igsh',
  'ref', 'ref_src', 'source', 'share', 's', 'si', 'feature',
]);

export type SourceType =
  | 'article' | 'youtube' | 'reel' | 'tweet' | 'pdf' | 'rss' | 'reddit' | 'podcast' | 'other';

export type ItemKind = 'bookmark' | 'content';

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
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) return shorts[1];
    const live = u.pathname.match(/^\/live\/([\w-]+)/);
    if (live) return live[1];
    const embed = u.pathname.match(/^\/embed\/([\w-]+)/);
    if (embed) return embed[1];
  }
  return null;
}

// Anchored to the host so `https://evil.example/?reddit.com/r/x/comments/y` is not a Reddit post.
export const REDDIT_POST_RE = /^https?:\/\/(?:[\w-]+\.)*reddit\.com\/r\/[^/]+\/comments\//i;

const DETECTION_RULES: Array<[RegExp, SourceType]> = [
  [/(?:youtube\.com\/(?:watch|shorts\/|live\/)|youtu\.be\/)/i, 'youtube'],
  [/instagram\.com\/(?:reel|reels|p|tv|share\/(?:reel|p))\//i, 'reel'],
  [/(?:tiktok\.com\/.+\/(?:video|photo)\/|(?:vm|vt)\.tiktok\.com\/)/i, 'reel'],
  [/(twitter|x)\.com\/[^/]+\/status\//i, 'tweet'],
  [REDDIT_POST_RE, 'reddit'],
  [/\.pdf(\?|#|$)/i, 'pdf'],
];

// URLs that unambiguously represent a single social post/video. Profiles,
// company pages, and social home pages deliberately do not match: those are
// useful website bookmarks rather than Reading items.
const SOCIAL_CONTENT_RULES = [
  /youtube\.com\/(watch|shorts\/|live\/)|youtu\.be\//i,
  /instagram\.com\/(reel|reels|p|tv|share\/(reel|p))\//i,
  /tiktok\.com\/.+\/(video|photo)\/|(?:vm|vt)\.tiktok\.com\//i,
  /(?:twitter|x)\.com\/[^/]+\/status\//i,
  REDDIT_POST_RE,
  /threads\.net\/@[^/]+\/post\//i,
  /linkedin\.com\/(?:posts|pulse|feed\/update)\//i,
  /(?:facebook\.com|fb\.watch|fb\.com)\/(?:share\/(?:r|p|v|s)?\/?|reel\/|watch\/?|.*\/posts\/|.*\/videos\/|photo|permalink\.php|story\.php)/i,
];

const READING_FILE_RE = /\.(?:pdf|epub|mobi|azw3?|fb2|djvu)(?:$|[?#])/i;
const ARTICLE_HOST_RE = /(^|\.)(?:medium\.com|substack\.com|dev\.to|hashnode\.com|arxiv\.org|researchgate\.net|wikipedia\.org|developer\.mozilla\.org|developer\.apple\.com|docs\.python\.org|doc\.rust-lang\.org)$/i;
const ARTICLE_ROUTE_RE = /\/(?:article|articles|blog|blogs|post|posts|news|story|stories|read|research|paper|papers|journal|publication|publications|ebook|ebooks|book|books|docs?|documentation|guides?|learn|reference|tutorials?|wiki)\b/i;
const DATE_ROUTE_RE = /\/20\d{2}\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])(?:\/|$)/;
const PAGE_FILE_RE = /\.(?:html?|md)(?:$|[?#])/i;
const WEBSITE_ROUTE_RE = /^\/(?:about|contact|pricing|plans|features?|products?|services?|login|sign-?in|sign-?up|register|account|dashboard|settings?|help|support|careers?|jobs?|privacy|terms|download)\/?$/i;

/**
 * Decide which user-facing surface owns a saved URL.
 *
 * - A website/domain home page is a Bookmark.
 * - A single social post/video, article/blog post, PDF or e-book is Reading.
 * - Ambiguous product/tool pages stay Bookmarks until the user explicitly
 *   chooses Reading. This avoids promoting ordinary sites just because their
 *   parser later extracts a long body.
 */
export function inferItemKind(raw: string, sourceType: SourceType = detectSourceType(raw)): ItemKind {
  if (sourceType === 'youtube' || sourceType === 'reel' || sourceType === 'tweet' ||
      sourceType === 'reddit' || sourceType === 'pdf' || sourceType === 'podcast' ||
      sourceType === 'rss') {
    return 'content';
  }
  if (SOCIAL_CONTENT_RULES.some((rule) => rule.test(raw)) || READING_FILE_RE.test(raw)) {
    return 'content';
  }

  let url: URL;
  try { url = new URL(raw); } catch { return 'bookmark'; }
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  if (path === '/' || /^\/(?:index|home)(?:\.html?)?$/i.test(path)) return 'bookmark';
  if (/^\/wiki\/(?:Main_Page|Special:)/i.test(path)) return 'bookmark';
  if (WEBSITE_ROUTE_RE.test(path)) return 'bookmark';

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (ARTICLE_HOST_RE.test(host) || ARTICLE_ROUTE_RE.test(path) || DATE_ROUTE_RE.test(path) || PAGE_FILE_RE.test(path)) {
    return 'content';
  }

  const segments = path.split('/').filter(Boolean);
  const leaf = segments.at(-1) ?? '';
  const slugWords = leaf.split(/[-_]+/).filter((part) => part.length > 1).length;
  if ((segments.length >= 2 && slugWords >= 3) || slugWords >= 5 || leaf.length >= 48) {
    return 'content';
  }
  return 'bookmark';
}

export function detectSourceType(url: string): SourceType {
  for (const [re, type] of DETECTION_RULES) {
    if (re.test(url)) return type;
  }
  return 'article';
}

/**
 * Cheap synchronous pre-check at capture time: http(s) only, length cap, and no
 * local names or non-public IP literals (IPv4 and IPv6, including CGNAT, link-local,
 * multicast and reserved ranges). It does NOT resolve DNS: fetching goes through
 * `safeFetch` (_shared/net.ts), which re-checks the resolved addresses and every redirect.
 */
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
  if (!checkHostname(u.hostname).ok) {
    return { ok: false, reason: 'Private or local addresses are not allowed' };
  }
  return { ok: true, url: u };
}
