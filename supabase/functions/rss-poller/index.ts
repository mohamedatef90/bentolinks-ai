// RSS/Atom poller: invoked every 30 minutes by pg_cron via pg_net (anon Bearer +
// x-worker-secret, like job-worker). For each active subscription that is due,
// do a conditional GET (ETag/Last-Modified), parse the feed, insert new entries
// as content_items (source_type='rss') and enqueue parse jobs for them.
//
// Also accepts user-JWT calls with {subscription_id} to force-poll one of the
// caller's own feeds immediately (FeedsView's "sync now" + first fetch after
// subscribing).
//
// Cost guards: at most NEW_ITEM_CAP items enter the enrich pipeline per feed
// per poll (protects the Gemini quota), and failing feeds back off
// exponentially via error_count until they are deactivated.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { serviceClient, getUser, getSecret } from '../_shared/db.ts';
import { canonicalizeUrl, validatePublicUrl } from '../_shared/canonical.ts';
import { enqueue } from '../_shared/queue.ts';
import { parseFeed } from '../_shared/feed.ts';
import { PARSER_UA } from '../_shared/parsers/types.ts';

const TIME_BUDGET_MS = 100_000;
const FETCH_TIMEOUT_MS = 20_000;
const NEW_ITEM_CAP = 10;         // max new items per feed per poll (enrichment throttle)
const ENTRY_WINDOW = 30;         // newest feed entries considered per poll
const BASE_INTERVAL_MIN = 30;    // healthy feeds are polled every cron tick
const MAX_ERROR_COUNT = 10;      // deactivate after this many consecutive failures

interface Subscription {
  id: string;
  user_id: string;
  feed_url: string;
  site_url: string | null;
  title: string | null;
  favicon_url: string | null;
  etag: string | null;
  last_modified: string | null;
  last_fetched_at: string | null;
  error_count: number;
  is_active: boolean;
}

/** Exponential backoff: 30m, 1h, 2h, 4h, 8h, 16h (capped). */
function pollIntervalMs(errorCount: number): number {
  return BASE_INTERVAL_MIN * 60_000 * Math.pow(2, Math.min(errorCount, 5));
}

function isDue(sub: Subscription): boolean {
  if (!sub.last_fetched_at) return true;
  // 60s grace so a tick that fires slightly early still polls healthy feeds.
  return Date.now() - Date.parse(sub.last_fetched_at) >= pollIntervalMs(sub.error_count) - 60_000;
}

async function pollSubscription(db: SupabaseClient, sub: Subscription): Promise<{ inserted: number; skipped: boolean }> {
  const headers: Record<string, string> = {
    'User-Agent': PARSER_UA,
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  };
  if (sub.etag) headers['If-None-Match'] = sub.etag;
  if (sub.last_modified) headers['If-Modified-Since'] = sub.last_modified;

  const res = await fetch(sub.feed_url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });

  if (res.status === 304) {
    await res.body?.cancel();
    await db.from('rss_subscriptions').update({
      last_fetched_at: new Date().toISOString(),
      error_count: 0,
      last_error: null,
    }).eq('id', sub.id);
    return { inserted: 0, skipped: true };
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Feed fetch HTTP ${res.status}`);
  }

  const feed = parseFeed(await res.text());

  // Newest first; unstamped entries keep feed order (feeds are newest-first by convention).
  const entries = feed.entries
    .map((e, i) => ({ ...e, order: i }))
    .sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : null;
      const tb = b.published_at ? Date.parse(b.published_at) : null;
      if (ta != null && tb != null) return tb - ta;
      return a.order - b.order;
    })
    .slice(0, ENTRY_WINDOW);

  // Canonicalize + drop invalid/private links.
  const candidates = entries.flatMap((e) => {
    const check = validatePublicUrl(e.link);
    if (!check.ok) return [];
    try {
      return [{ ...e, canonical: canonicalizeUrl(e.link) }];
    } catch {
      return [];
    }
  });

  // Which are already in this user's vault?
  const canonicals = candidates.map((c) => c.canonical);
  const existing = new Set<string>();
  if (canonicals.length > 0) {
    const { data } = await db
      .from('content_items')
      .select('canonical_url')
      .eq('user_id', sub.user_id)
      .in('canonical_url', canonicals);
    for (const row of data ?? []) existing.add(row.canonical_url as string);
  }

  const fresh = candidates.filter((c) => !existing.has(c.canonical)).slice(0, NEW_ITEM_CAP);

  let inserted = 0;
  for (const entry of fresh) {
    // on conflict do nothing (unique user_id+canonical_url) — races with saves are fine.
    const { data: item, error } = await db
      .from('content_items')
      .upsert({
        user_id: sub.user_id,
        url: entry.link,
        canonical_url: entry.canonical,
        source_type: 'rss',
        status: 'pending',
        title: entry.title,
        description: entry.description,
        published_at: entry.published_at,
        rss_subscription_id: sub.id,
      }, { onConflict: 'user_id,canonical_url', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
    if (error) {
      console.error(`insert failed for ${entry.link}:`, error.message);
      continue;
    }
    if (!item) continue; // duplicate raced in

    await enqueue(db, { user_id: sub.user_id, item_id: item.id, job_type: 'parse' });
    inserted++;
  }

  const domain = (() => {
    try {
      return new URL(feed.site_url ?? sub.feed_url).hostname;
    } catch {
      return new URL(sub.feed_url).hostname;
    }
  })();

  await db.from('rss_subscriptions').update({
    title: sub.title ?? feed.title,
    site_url: sub.site_url ?? feed.site_url,
    favicon_url: sub.favicon_url ?? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    etag: res.headers.get('etag'),
    last_modified: res.headers.get('last-modified'),
    last_fetched_at: new Date().toISOString(),
    error_count: 0,
    last_error: null,
  }).eq('id', sub.id);

  return { inserted, skipped: false };
}

async function markFailure(db: SupabaseClient, sub: Subscription, err: string) {
  const errorCount = sub.error_count + 1;
  await db.from('rss_subscriptions').update({
    last_fetched_at: new Date().toISOString(),
    error_count: errorCount,
    last_error: err.slice(0, 1000),
    is_active: errorCount < MAX_ERROR_COUNT,
  }).eq('id', sub.id);
}

async function pollAllDue(db: SupabaseClient): Promise<{ polled: number; inserted: number; failed: number }> {
  const started = Date.now();
  const { data: subs, error } = await db
    .from('rss_subscriptions')
    .select('*')
    .eq('is_active', true)
    .order('last_fetched_at', { ascending: true, nullsFirst: true });
  if (error) throw new Error(`load subscriptions failed: ${error.message}`);

  let polled = 0, inserted = 0, failed = 0;
  for (const sub of (subs ?? []) as Subscription[]) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    if (!isDue(sub)) continue;
    try {
      const r = await pollSubscription(db, sub);
      polled++;
      inserted += r.inserted;
    } catch (e) {
      failed++;
      console.error(`poll failed for ${sub.feed_url}:`, (e as Error).message);
      await markFailure(db, sub, (e as Error).message);
    }
  }
  return { polled, inserted, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

  const db = serviceClient();
  const expected = await getSecret(db, 'WORKER_SECRET');

  // Cron path: poll every due subscription in the background.
  if (expected && req.headers.get('x-worker-secret') === expected) {
    EdgeRuntime.waitUntil(
      pollAllDue(db)
        .then((r) => console.log(`rss-poller done: ${JSON.stringify(r)}`))
        .catch((e) => console.error('rss-poller crashed:', (e as Error).message)),
    );
    return corsResponse({ accepted: true }, 202);
  }

  // User path: force-poll one of the caller's own subscriptions right now.
  const user = await getUser(req);
  if (!user) return corsResponse({ error: 'UNAUTHORIZED' }, 401);

  let body: { subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'INVALID_REQUEST', message: 'Body must be JSON' }, 400);
  }
  if (!body.subscription_id) {
    return corsResponse({ error: 'INVALID_REQUEST', message: 'subscription_id required' }, 400);
  }

  const { data: sub } = await db
    .from('rss_subscriptions')
    .select('*')
    .eq('id', body.subscription_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sub) return corsResponse({ error: 'NOT_FOUND' }, 404);

  try {
    const r = await pollSubscription(db, sub as Subscription);
    return corsResponse({ ok: true, ...r });
  } catch (e) {
    await markFailure(db, sub as Subscription, (e as Error).message);
    return corsResponse({ error: 'POLL_FAILED', message: (e as Error).message }, 502);
  }
});
