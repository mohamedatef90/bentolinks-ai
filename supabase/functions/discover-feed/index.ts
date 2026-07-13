// Feed discovery + validation (user JWT). POST {url}:
//  - if the URL is itself an RSS/Atom feed, validate it and return it as the
//    single candidate (with the feed's own title) — this doubles as the
//    "validate before insert" step FeedsView runs on every subscribe;
//  - if it's an HTML page, return the <link rel="alternate"> feed candidates,
//    probing a few conventional paths (/feed, /rss.xml, ...) when none exist.

import { parseHTML } from 'npm:linkedom@0.18';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getUser } from '../_shared/db.ts';
import { validatePublicUrl } from '../_shared/canonical.ts';
import { PARSER_UA } from '../_shared/parsers/types.ts';
import { parseFeed } from '../_shared/feed.ts';

const FETCH_TIMEOUT_MS = 15_000;
const FALLBACK_PATHS = ['/feed', '/rss', '/rss.xml', '/atom.xml', '/index.xml', '/feed.xml'];

export interface FeedCandidate {
  title: string | null;
  feed_url: string;
  /** true when the feed was actually fetched and parsed (safe to subscribe as-is). */
  validated: boolean;
}

const FEED_TYPE_RE = /application\/(rss\+xml|atom\+xml|xml|feed\+json)|text\/xml/i;

function looksLikeFeedBody(bodyStart: string): boolean {
  const s = bodyStart.trimStart();
  return s.startsWith('<?xml') || s.startsWith('<rss') || s.startsWith('<feed') || s.startsWith('<rdf:RDF');
}

async function fetchPage(url: string): Promise<{ finalUrl: string; contentType: string; body: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': PARSER_UA,
      Accept: 'application/rss+xml, application/atom+xml, text/html, application/xml, */*',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`HTTP ${res.status}`);
  }
  return {
    finalUrl: res.url,
    contentType: res.headers.get('content-type') ?? '',
    body: await res.text(),
  };
}

/** Try to parse a URL as a feed; null when it isn't one. */
async function tryValidateFeed(url: string): Promise<FeedCandidate | null> {
  try {
    const page = await fetchPage(url);
    if (!FEED_TYPE_RE.test(page.contentType) && !looksLikeFeedBody(page.body)) return null;
    const feed = parseFeed(page.body);
    return { title: feed.title, feed_url: page.finalUrl, validated: true };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

  const user = await getUser(req);
  if (!user) return corsResponse({ error: 'UNAUTHORIZED' }, 401);

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'INVALID_REQUEST', message: 'Body must be JSON' }, 400);
  }
  const raw = (body.url ?? '').trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const check = validatePublicUrl(withScheme);
  if (!check.ok) return corsResponse({ error: 'INVALID_URL', message: check.reason }, 400);

  let page: { finalUrl: string; contentType: string; body: string };
  try {
    page = await fetchPage(check.url.toString());
  } catch (e) {
    return corsResponse({ error: 'FETCH_FAILED', message: (e as Error).message }, 502);
  }

  // Case 1: the URL is a feed itself.
  if (FEED_TYPE_RE.test(page.contentType) || looksLikeFeedBody(page.body)) {
    try {
      const feed = parseFeed(page.body);
      return corsResponse({
        candidates: [{ title: feed.title, feed_url: page.finalUrl, validated: true } satisfies FeedCandidate],
      });
    } catch (e) {
      return corsResponse({ error: 'INVALID_FEED', message: (e as Error).message }, 422);
    }
  }

  // Case 2: HTML page — collect <link rel="alternate"> feed declarations.
  const { document } = parseHTML(page.body);
  const seen = new Set<string>();
  const candidates: FeedCandidate[] = [];
  for (const el of document.querySelectorAll('link[rel="alternate"]')) {
    const type = el.getAttribute('type') ?? '';
    if (!/application\/(rss|atom)\+xml|application\/feed\+json/i.test(type)) continue;
    const href = el.getAttribute('href');
    if (!href) continue;
    try {
      const abs = new URL(href, page.finalUrl).toString();
      if (seen.has(abs)) continue;
      seen.add(abs);
      candidates.push({ title: el.getAttribute('title'), feed_url: abs, validated: false });
    } catch {
      // unparsable href — skip
    }
  }

  // Case 3: nothing declared — probe conventional paths (first hit wins).
  if (candidates.length === 0) {
    const origin = new URL(page.finalUrl).origin;
    for (const path of FALLBACK_PATHS) {
      const found = await tryValidateFeed(origin + path);
      if (found) {
        candidates.push(found);
        break;
      }
    }
  }

  return corsResponse({ candidates });
});
