/// <reference lib="deno.ns" />
// Run with Deno: `npm run test:edge`. Proves the stored-SSRF path is closed in rss-poller:
// a subscription whose host is (or redirects to) a private address is paused with a clear
// error and never retried, a transient DNS failure still backs off normally, and a
// normal public feed still works. DNS and fetch are stubbed; nothing touches the network.

import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createFakeDb, USER_A } from './helpers/fake-db.mjs';

// Supabase injects `EdgeRuntime` at runtime; it has no published types.
declare global {
  // deno-lint-ignore no-var
  var EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
}

// deno-lint-ignore no-explicit-any
(Deno as any).serve = () => ({}); // rss-poller starts a server at import time
const { pollAllDue } = await import('../supabase/functions/rss-poller/index.ts');

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example news</title><link>https://news.example/</link>
<item><title>Fresh post</title><link>https://news.example/a-fresh-post</link><pubDate>${new Date().toUTCString()}</pubDate><description>Hello</description></item>
</channel></rss>`;

const PUBLIC_IP = '93.184.216.34';

function install(opts: { dns: Record<string, string[] | Error>; fetch: (url: string) => Response }) {
  const fetchCalls: string[] = [];
  const realFetch = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  const d = Deno as any;
  const realResolve = d.resolveDns;
  d.resolveDns = (host: string, type: string) => {
    const e = opts.dns[host];
    if (e instanceof Error) return Promise.reject(e);
    if (!e || type === 'AAAA') return Promise.reject(Object.assign(new Error('no records found'), { name: 'NotFound' }));
    return Promise.resolve(e);
  };
  globalThis.fetch = ((input: string | URL) => {
    const url = String(input);
    fetchCalls.push(url);
    return Promise.resolve(opts.fetch(url));
  }) as typeof fetch;
  return {
    fetchCalls,
    restore() { globalThis.fetch = realFetch; d.resolveDns = realResolve; },
  };
}

const sub = (feed_url: string) => ({
  id: 's1', user_id: USER_A, feed_url, title: null, site_url: null, favicon_url: null,
  etag: null, last_modified: null, last_fetched_at: null, error_count: 0, is_active: true,
});

Deno.test('a feed on a private address is paused with a clear error and never fetched or retried', async () => {
  const net = install({ dns: { 'internal.attacker.example': ['10.0.0.7'] }, fetch: () => new Response('SECRET') });
  try {
    const db = createFakeDb({ rss_subscriptions: [sub('https://internal.attacker.example/feed')], content_items: [], jobs: [] });
    const first = await pollAllDue(db);
    assertEquals(first.failed, 1);
    assertEquals(net.fetchCalls.length, 0, 'no request may be sent to a private host');
    const row = db.tables.rss_subscriptions[0];
    assertEquals(row.is_active, false);
    assertMatch(row.last_error, /^Blocked: /);
    assertEquals(row.error_count, 1);
    // Next tick: the paused subscription is not selected again.
    const second = await pollAllDue(db);
    assertEquals(second.polled + second.failed, 0);
    assertEquals(net.fetchCalls.length, 0);
    assertEquals(db.tables.content_items.length, 0);
  } finally { net.restore(); }
});

Deno.test('a feed that redirects to a private address is blocked after the first hop', async () => {
  const net = install({
    dns: { 'feeds.example': [PUBLIC_IP] },
    fetch: () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),
  });
  try {
    const db = createFakeDb({ rss_subscriptions: [sub('https://feeds.example/rss')], content_items: [], jobs: [] });
    await pollAllDue(db);
    assertEquals(net.fetchCalls, ['https://feeds.example/rss']);
    assertEquals(db.tables.rss_subscriptions[0].is_active, false);
    assertMatch(db.tables.rss_subscriptions[0].last_error, /^Blocked: /);
  } finally { net.restore(); }
});

Deno.test('a transient DNS failure backs off normally: still active, no "Blocked", nothing fetched', async () => {
  const net = install({ dns: { 'flaky.example': new Error('SERVFAIL') }, fetch: () => new Response('x') });
  try {
    const db = createFakeDb({ rss_subscriptions: [sub('https://flaky.example/rss')], content_items: [], jobs: [] });
    await pollAllDue(db);
    const row = db.tables.rss_subscriptions[0];
    assertEquals(net.fetchCalls.length, 0);
    assertEquals(row.is_active, true);
    assertEquals(row.error_count, 1);
    assert(!String(row.last_error).startsWith('Blocked:'));
  } finally { net.restore(); }
});

Deno.test('a normal public feed still works end to end', async () => {
  const net = install({
    dns: { 'news.example': [PUBLIC_IP] },
    fetch: () => new Response(RSS, { status: 200, headers: { 'content-type': 'application/rss+xml' } }),
  });
  try {
    const db = createFakeDb({ rss_subscriptions: [sub('https://news.example/rss')], content_items: [], jobs: [] });
    const r = await pollAllDue(db);
    assertEquals(r.polled, 1);
    assertEquals(r.inserted, 1);
    assertEquals(db.tables.content_items.length, 1);
    assertEquals(db.tables.content_items[0].url, 'https://news.example/a-fresh-post');
    assertEquals(db.tables.jobs.length, 1);
    const row = db.tables.rss_subscriptions[0];
    assertEquals(row.is_active, true);
    assertEquals(row.error_count, 0);
    assertEquals(row.title, 'Example news');
  } finally { net.restore(); }
});
