// Reddit parser. Reddit 403s datacenter IPs on the public www.reddit.com/*.json
// endpoints, so the reliable path is app-only OAuth against oauth.reddit.com:
//   - REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in Vault  → authenticated (reliable)
//   - neither set                                       → public .json (often 403 from cloud)
// Either way we capture the post body + top comments so enrich has real text.

import { ParsedContent, wordCount } from './types.ts';

// Reddit requires a unique, descriptive User-Agent — generic/browser UAs get throttled.
const REDDIT_UA = 'web:refvault:1.0 (by /u/refvault)';

export interface RedditKeys {
  clientId: string | null;
  clientSecret: string | null;
}

function stripHtmlEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) =>
      ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' })[m] ?? ' ')
    .trim();
}

/** Post id + subreddit from any Reddit permalink. */
function parsePermalink(url: string): { sub: string; id: string } | null {
  const m = new URL(url).pathname.match(/\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
  return m ? { sub: m[1], id: m[2] } : null;
}

/** App-only OAuth token (client_credentials) — cached per isolate until expiry. */
let tokenCache: { token: string; expires: number } | null = null;
async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now() + 30_000) return tokenCache.token;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_UA,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Reddit token HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.access_token) throw new Error('Reddit token: no access_token');
  tokenCache = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

/** Fetch the [post, comments] listing pair, authenticated when creds exist. */
async function fetchListing(url: string, keys: RedditKeys): Promise<any> {
  const permalink = parsePermalink(url);

  if (keys.clientId && keys.clientSecret && permalink) {
    const token = await getAppToken(keys.clientId, keys.clientSecret);
    const apiUrl = `https://oauth.reddit.com/r/${permalink.sub}/comments/${permalink.id}?raw_json=1&limit=10`;
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': REDDIT_UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Reddit OAuth HTTP ${res.status}`);
    return await res.json();
  }

  // Public fallback — works from residential IPs, usually 403s from cloud.
  const u = new URL(url);
  u.hash = '';
  u.search = '';
  const jsonUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}.json?raw_json=1&limit=10`;
  const res = await fetch(jsonUrl, {
    headers: { 'User-Agent': REDDIT_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Reddit JSON HTTP ${res.status}`);
  return await res.json();
}

export async function parseReddit(url: string, keys: RedditKeys): Promise<ParsedContent> {
  const data = await fetchListing(url, keys);
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error('Reddit: no post node in listing');

  const title: string = post.title ?? 'Reddit post';
  const selftext: string = typeof post.selftext === 'string' ? post.selftext.trim() : '';
  const subreddit: string = post.subreddit_name_prefixed ?? (post.subreddit ? `r/${post.subreddit}` : '');
  const author: string = post.author ? `u/${post.author}` : 'unknown';

  // Top comments (skip stickied/AutoModerator), capped for the enrich token budget.
  const commentNodes: any[] = data?.[1]?.data?.children ?? [];
  const topComments = commentNodes
    .map((c) => c?.data)
    .filter((c) => c && c.body && !c.stickied && c.author !== 'AutoModerator')
    .slice(0, 5)
    .map((c) => `u/${c.author} (${c.score ?? 0}▲): ${stripHtmlEntities(String(c.body))}`);

  const contentParts: string[] = [];
  if (selftext) contentParts.push(selftext);
  else if (post.url && !post.is_self) contentParts.push(`Link: ${post.url}`);
  if (topComments.length) contentParts.push('Top comments:\n' + topComments.join('\n\n'));
  const content = contentParts.join('\n\n').trim() || null;

  // Reddit thumbnails are sometimes the strings "self"/"default"/"nsfw".
  const rawThumb: string | undefined = post.preview?.images?.[0]?.source?.url ?? post.thumbnail;
  const thumbnail = rawThumb && /^https?:\/\//.test(rawThumb) ? stripHtmlEntities(rawThumb) : null;

  return {
    title,
    description: (selftext || title).slice(0, 300),
    author,
    site_name: subreddit || 'Reddit',
    thumbnail_url: thumbnail,
    favicon_url: 'https://www.google.com/s2/favicons?domain=reddit.com&sz=64',
    published_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
    content_text: content,
    word_count: wordCount(content),
    duration_seconds: null,
    raw_metadata: {
      subreddit,
      score: post.score ?? null,
      upvote_ratio: post.upvote_ratio ?? null,
      num_comments: post.num_comments ?? null,
      is_video: !!post.is_video,
      permalink: post.permalink ? `https://www.reddit.com${post.permalink}` : url,
    },
  };
}
