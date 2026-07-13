// Tweet parser via the fxtwitter JSON API (no auth). If it fails, the worker's
// dispatch falls back to the generic OG/article parse and the item degrades.

import { ParsedContent, PARSER_UA, wordCount } from './types.ts';

export async function parseTweet(url: string): Promise<ParsedContent> {
  const m = url.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i);
  if (!m) throw new Error('Could not extract tweet id');
  const [, screenName, tweetId] = m;

  const res = await fetch(`https://api.fxtwitter.com/${screenName}/status/${tweetId}`, {
    headers: { 'User-Agent': PARSER_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`fxtwitter HTTP ${res.status}`);
  const json = await res.json();
  const tweet = json?.tweet;
  if (json?.code !== 200 || !tweet) throw new Error(`fxtwitter code ${json?.code ?? 'unknown'}`);

  const authorName = tweet.author?.name ?? screenName;
  const parts: string[] = [];
  if (tweet.text) parts.push(tweet.text);
  if (tweet.quote?.text) {
    parts.push(`Quoted @${tweet.quote.author?.screen_name ?? 'unknown'}: ${tweet.quote.text}`);
  }
  const content = parts.join('\n\n').trim() || null;

  const photo = tweet.media?.photos?.[0]?.url ?? tweet.media?.videos?.[0]?.thumbnail_url ?? null;
  const publishedAt = tweet.created_timestamp
    ? new Date(tweet.created_timestamp * 1000).toISOString()
    : null;

  return {
    title: `${authorName} (@${tweet.author?.screen_name ?? screenName}) on X`,
    description: tweet.text?.slice(0, 300) ?? null,
    author: authorName,
    site_name: 'X (Twitter)',
    thumbnail_url: photo ?? tweet.author?.avatar_url ?? null,
    favicon_url: 'https://www.google.com/s2/favicons?domain=x.com&sz=64',
    published_at: publishedAt,
    content_text: content,
    word_count: wordCount(content),
    duration_seconds: null,
    raw_metadata: {
      tweet_id: tweetId,
      screen_name: tweet.author?.screen_name ?? screenName,
      likes: tweet.likes ?? null,
      retweets: tweet.retweets ?? null,
      replies: tweet.replies ?? null,
      has_media: !!(tweet.media?.photos?.length || tweet.media?.videos?.length),
    },
  };
}
