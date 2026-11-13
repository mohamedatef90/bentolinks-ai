import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DnsResolutionError,
  FetchLimitError,
  SsrfError,
  checkHostname,
  classifyIp,
  isPublicIp,
  safeFetch,
} from '../supabase/functions/_shared/net.ts';
import { detectSourceType, inferItemKind, validatePublicUrl } from '../supabase/functions/_shared/canonical.ts';

// ---- IP classifier ---------------------------------------------------------------

const NON_PUBLIC_V4 = [
  '0.0.0.0', '0.255.255.255', '10.0.0.0', '10.255.255.255', '100.64.0.0', '100.127.255.255',
  '127.0.0.1', '127.255.255.255', '169.254.0.1', '169.254.169.254', '172.16.0.0', '172.31.255.255',
  '192.0.0.1', '192.0.2.1', '192.168.0.0', '192.168.255.255', '198.18.0.0', '198.19.255.255',
  '198.51.100.7', '203.0.113.9', '224.0.0.0', '239.255.255.255', '240.0.0.0', '255.255.255.255',
];
const PUBLIC_V4 = [
  '1.0.0.0', '8.8.8.8', '1.1.1.1', '9.255.255.255', '11.0.0.0', '100.63.255.255', '100.128.0.0',
  '126.255.255.255', '128.0.0.0', '169.253.255.255', '169.255.0.0', '172.15.255.255', '172.32.0.0',
  '192.0.1.1', '192.167.255.255', '192.169.0.0', '198.17.255.255', '198.20.0.0', '223.255.255.255',
  '93.184.216.34',
];

test('IPv4: non-public ranges and their edges are rejected', () => {
  for (const ip of NON_PUBLIC_V4) assert.equal(isPublicIp(ip), false, ip);
});

test('IPv4: addresses just outside each blocked range are public', () => {
  for (const ip of PUBLIC_V4) assert.equal(isPublicIp(ip), true, ip);
});

test('IPv4: malformed or ambiguous literals are never public', () => {
  for (const ip of ['256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.2.3.04', '', 'abc', '1.2.3.-4']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test('IPv6: loopback, unspecified, unique-local, link-local, multicast are rejected', () => {
  for (const ip of ['::', '::1', '0:0:0:0:0:0:0:1', 'fc00::', 'fd12:3456::1', 'fdff:ffff:ffff::1', 'fe80::1',
    'febf::1', 'fec0::1', 'ff00::', 'ff02::1', '[::1]']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test('IPv6: IPv4-mapped addresses are judged by the embedded IPv4 address', () => {
  assert.equal(isPublicIp('::ffff:127.0.0.1'), false);
  assert.equal(isPublicIp('::ffff:7f00:1'), false);
  assert.equal(isPublicIp('::ffff:10.1.2.3'), false);
  assert.equal(isPublicIp('::ffff:169.254.169.254'), false);
  assert.equal(isPublicIp('0:0:0:0:0:ffff:192.168.1.1'), false);
  assert.equal(isPublicIp('::ffff:8.8.8.8'), true);
  assert.equal(isPublicIp('::ffff:808:808'), true);
});

test('IPv6: IPv4-translated ::ffff:0:a.b.c.d is judged by the embedded IPv4 address', () => {
  for (const ip of ['::ffff:0:127.0.0.1', '::ffff:0:7f00:1', '::ffff:0:10.0.0.1', '::ffff:0:169.254.169.254', '::ffff:0:192.168.1.1',
    '::ffff:0:100.64.0.1', '0:0:0:0:ffff:0:a00:1', '[::ffff:0:7f00:1]']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
  assert.equal(isPublicIp('::ffff:0:8.8.8.8'), true);
  assert.equal(isPublicIp('::ffff:0:808:808'), true);
  // the mapped form still behaves as before
  assert.equal(isPublicIp('::ffff:7f00:1'), false);
  assert.equal(isPublicIp('::ffff:808:808'), true);
});

test('IPv6: the rest of the reserved ::/8 space is not public', () => {
  for (const ip of ['0:1::1', '::1:0:0:0:1', '::ffff:1:0:0', '0:ffff::1', 'ff:0:0:0:0:0:0:1']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test('a hostname that resolves to an IPv4-translated private address is rejected before any request', async () => {
  const resolve = resolverFor({ 'sneaky.example': { AAAA: ['::ffff:0:7f00:1'] } });
  const doFetch = fetchStub(() => ok());
  await assert.rejects(() => safeFetch('https://sneaky.example/', {}, { resolve, fetch: doFetch }), SsrfError);
  assert.equal(doFetch.calls.length, 0);
});

test('IPv6: NAT64, IPv4-compatible, 6to4, Teredo and documentation ranges', () => {
  assert.equal(isPublicIp('64:ff9b::1.2.3.4'), false);
  assert.equal(isPublicIp('64:ff9b::808:808'), false);
  assert.equal(isPublicIp('::10.0.0.1'), false);
  assert.equal(isPublicIp('2002:7f00:1::'), false); // 6to4 of 127.0.0.1
  assert.equal(isPublicIp('2002:0a00:0001::'), false); // 6to4 of 10.0.0.1
  assert.equal(isPublicIp('2002:808:808::'), true); // 6to4 of 8.8.8.8
  assert.equal(isPublicIp('2001::1'), false);
  assert.equal(isPublicIp('2001:db8::1'), false);
});

test('IPv6: ordinary global addresses are public', () => {
  for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '2a00:1450:4001::200e', 'fe00::1']) {
    assert.equal(isPublicIp(ip), true, ip);
  }
});

test('IPv6: malformed literals and zone ids are never public', () => {
  for (const ip of ['zzzz::', '1:2:3:4:5:6:7:8:9', '::1::2', '12345::', 'fe80::1%eth0', ':::', '1:2:3']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test('classifyIp reports a reason', () => {
  assert.equal(classifyIp('10.0.0.1').reason, 'private');
  assert.equal(classifyIp('100.64.0.1').reason, 'cgnat');
  assert.equal(classifyIp('::1').reason, 'unspecified-or-loopback');
});

// ---- hostname and capture-time validation -----------------------------------------

test('checkHostname rejects local names and non-public literals only', () => {
  for (const h of ['localhost', 'LOCALHOST.', 'app.localhost', 'printer.local', 'db.internal', 'x.localdomain', '127.0.0.1', '[::1]']) {
    assert.equal(checkHostname(h).ok, false, h);
  }
  for (const h of ['example.com', 'sub.example.co.uk', '10.example.com', '8.8.8.8', '[2606:4700:4700::1111]', 'localhost.example.com']) {
    assert.equal(checkHostname(h).ok, true, h);
  }
});

test('validatePublicUrl blocks IPv6 literals, odd IPv4 notations and extra ranges', () => {
  for (const raw of [
    'http://[::1]/', 'http://[fc00::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[fe80::1]/',
    'http://2130706433/', 'http://0x7f.1/', 'http://127.1/', 'http://017700000001/',
    'http://100.64.0.1/', 'http://198.18.0.1/', 'http://224.0.0.1/', 'http://192.0.0.8/',
    'http://169.254.169.254/latest/meta-data', 'http://localhost:8080/', 'http://x.internal/', 'http://[64:ff9b::7f00:1]/',
  ]) {
    assert.equal(validatePublicUrl(raw).ok, false, raw);
  }
});

test('validatePublicUrl still accepts normal public URLs (and no longer rejects "10.example.com")', () => {
  for (const raw of ['https://example.com/a?b=1', 'http://8.8.8.8/', 'https://10.example.com/x', 'https://[2606:4700:4700::1111]/']) {
    assert.equal(validatePublicUrl(raw).ok, true, raw);
  }
  assert.equal(validatePublicUrl('ftp://example.com/').ok, false);
  assert.equal(validatePublicUrl('not a url').ok, false);
  assert.equal(validatePublicUrl('https://example.com/' + 'a'.repeat(2100)).ok, false);
});

test('Reddit detection is anchored to the host', () => {
  assert.equal(detectSourceType('https://www.reddit.com/r/programming/comments/abc123/title/'), 'reddit');
  assert.equal(detectSourceType('https://old.reddit.com/r/programming/comments/abc123/title/'), 'reddit');
  assert.equal(detectSourceType('https://reddit.com/r/programming/comments/abc123/'), 'reddit');
  for (const evil of [
    'https://evil.example/reddit.com/r/x/comments/y',
    'https://evil.example/?u=reddit.com/r/x/comments/y',
    'https://reddit.com.evil.example/r/x/comments/y',
    'https://notreddit.com/r/x/comments/y',
  ]) {
    assert.notEqual(detectSourceType(evil), 'reddit', evil);
  }
  assert.equal(inferItemKind('https://www.reddit.com/r/x/comments/y/z/'), 'content');
});

// ---- safeFetch ---------------------------------------------------------------------

const PUBLIC = '93.184.216.34';

/** resolver: map hostname -> { A?: string[], AAAA?: string[], error?: Error } */
function resolverFor(table) {
  const calls = [];
  const resolve = async (host, type) => {
    calls.push(`${host}:${type}`);
    const e = table[host];
    if (!e) throw Object.assign(new Error('no records found'), { name: 'NotFound' });
    if (e.error) throw e.error;
    const v = e[type];
    if (!v) throw Object.assign(new Error('no records found'), { name: 'NotFound' });
    return v;
  };
  resolve.calls = calls;
  return resolve;
}

/** fetch stub: responses is a function(url, init) -> Response or a list consumed in order */
function fetchStub(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  fn.calls = calls;
  return fn;
}
const redirect = (to, status = 302) => new Response(null, { status, headers: { location: to } });
const ok = (body = 'ok', headers = {}) => new Response(body, { status: 200, headers });

function captureWarnings(fn) {
  const original = console.warn;
  const lines = [];
  console.warn = (line) => lines.push(line);
  return fn().finally(() => { console.warn = original; }).then((value) => ({ value, lines }), (error) => { throw Object.assign(error, { warnings: lines }); });
}

test('a public host is fetched once, with manual redirects, and the final URL is exposed', async () => {
  const resolve = resolverFor({ 'example.com': { A: [PUBLIC] } });
  const doFetch = fetchStub(() => ok('hello'));
  const res = await safeFetch('https://example.com/page', { headers: { 'User-Agent': 'x' } }, { resolve, fetch: doFetch });
  assert.equal(await res.text(), 'hello');
  assert.equal(res.url, 'https://example.com/page');
  assert.equal(doFetch.calls.length, 1);
  assert.equal(doFetch.calls[0].init.redirect, 'manual');
});

test('a hostname that resolves to a private address is rejected before any request', async () => {
  for (const address of ['10.0.0.5', '127.0.0.1', '169.254.169.254', '100.64.1.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    const resolve = resolverFor({ 'app.127.0.0.1.nip.io': { A: address.includes(':') ? undefined : [address], AAAA: address.includes(':') ? [address] : undefined } });
    const doFetch = fetchStub(() => ok());
    await assert.rejects(() => safeFetch('http://app.127.0.0.1.nip.io/', {}, { resolve, fetch: doFetch }), (e) => e instanceof SsrfError && /resolves to a private/.test(e.message), address);
    assert.equal(doFetch.calls.length, 0, address);
  }
});

test('one private address among several is enough to reject (A public, AAAA private)', async () => {
  const resolve = resolverFor({ 'mixed.example': { A: [PUBLIC], AAAA: ['fc00::1'] } });
  const doFetch = fetchStub(() => ok());
  await assert.rejects(() => safeFetch('https://mixed.example/', {}, { resolve, fetch: doFetch }), SsrfError);
  assert.equal(doFetch.calls.length, 0);
});

test('IP literals are classified without a DNS lookup', async () => {
  const resolve = resolverFor({});
  const doFetch = fetchStub(() => ok());
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'http://[::ffff:7f00:1]/', 'http://169.254.169.254/latest/meta-data/', 'http://2130706433/', 'http://100.100.100.100/']) {
    await assert.rejects(() => safeFetch(url, {}, { resolve, fetch: doFetch }), SsrfError, url);
  }
  assert.equal(resolve.calls.length, 0);
  assert.equal(doFetch.calls.length, 0);
  const publicLiteral = await safeFetch('http://93.184.216.34/', {}, { resolve, fetch: fetchStub(() => ok('x')) });
  assert.equal(await publicLiteral.text(), 'x');
});

test('a public URL that redirects to http://127.0.0.1 is rejected and the redirect is never requested', async () => {
  const resolve = resolverFor({ 'example.com': { A: [PUBLIC] } });
  const doFetch = fetchStub((url) => (url.startsWith('https://example.com') ? redirect('http://127.0.0.1/admin') : ok('SECRET')));
  await assert.rejects(() => safeFetch('https://example.com/start', {}, { resolve, fetch: doFetch }), (e) => e instanceof SsrfError);
  assert.equal(doFetch.calls.length, 1);
  assert.equal(doFetch.calls[0].url, 'https://example.com/start');
});

test('every redirect hop is re-resolved: a hop to a name that resolves privately is rejected', async () => {
  const resolve = resolverFor({ 'example.com': { A: [PUBLIC] }, 'rebind.example': { A: ['192.168.1.10'] } });
  const doFetch = fetchStub((url) => (url.includes('example.com/') && !url.includes('rebind') ? redirect('https://rebind.example/x') : ok('SECRET')));
  await assert.rejects(() => safeFetch('https://example.com/', {}, { resolve, fetch: doFetch }), SsrfError);
  assert.equal(doFetch.calls.length, 1);
});

test('redirects are followed across public hosts, including relative Location headers', async () => {
  const resolve = resolverFor({ 'a.example': { A: [PUBLIC] }, 'b.example': { A: [PUBLIC] } });
  const doFetch = fetchStub((url) => {
    if (url === 'https://a.example/start') return redirect('/next');
    if (url === 'https://a.example/next') return redirect('https://b.example/final', 301);
    return ok('done');
  });
  const res = await safeFetch('https://a.example/start', {}, { resolve, fetch: doFetch });
  assert.equal(await res.text(), 'done');
  assert.equal(res.url, 'https://b.example/final');
  assert.deepEqual(doFetch.calls.map((c) => c.url), ['https://a.example/start', 'https://a.example/next', 'https://b.example/final']);
});

test('the hop limit is enforced: 5 redirects are followed, the 6th is refused', async () => {
  const resolve = resolverFor({ 'loop.example': { A: [PUBLIC] } });
  const doFetch = fetchStub((url, _init, n) => redirect(`https://loop.example/${n}`));
  await assert.rejects(() => safeFetch('https://loop.example/0', {}, { resolve, fetch: doFetch }), (e) => e instanceof SsrfError && e.reason === 'too-many-redirects');
  assert.equal(doFetch.calls.length, 6);
});

test('exactly 5 redirects then a 200 succeeds', async () => {
  const resolve = resolverFor({ 'chain.example': { A: [PUBLIC] } });
  const doFetch = fetchStub((url, _init, n) => (n <= 5 ? redirect(`https://chain.example/${n}`) : ok('end')));
  const res = await safeFetch('https://chain.example/start', {}, { resolve, fetch: doFetch });
  assert.equal(await res.text(), 'end');
  assert.equal(doFetch.calls.length, 6);
});

test('redirects to non-http schemes and malformed Locations are refused', async () => {
  const resolve = resolverFor({ 'example.com': { A: [PUBLIC] } });
  for (const location of ['file:///etc/passwd', 'ftp://example.com/x', 'gopher://example.com/', 'http://']) {
    const doFetch = fetchStub(() => redirect(location));
    await assert.rejects(() => safeFetch('https://example.com/', {}, { resolve, fetch: doFetch }), SsrfError, location);
    assert.equal(doFetch.calls.length, 1);
  }
});

test('Authorization and Cookie headers are dropped on a cross-origin redirect', async () => {
  const resolve = resolverFor({ 'a.example': { A: [PUBLIC] }, 'b.example': { A: [PUBLIC] } });
  const seen = [];
  const doFetch = fetchStub((url, init) => { seen.push([...new Headers(init.headers).keys()]); return url.startsWith('https://a.example') ? redirect('https://b.example/') : ok(); });
  await safeFetch('https://a.example/', { headers: { Authorization: 'Bearer t', Cookie: 'c=1', 'X-Keep': '1' } }, { resolve, fetch: doFetch });
  assert.deepEqual(seen[0].sort(), ['authorization', 'cookie', 'x-keep']);
  assert.deepEqual(seen[1], ['x-keep']);
});

test('fail closed: a resolver error blocks the request and logs ssrf_resolver_error', async () => {
  const resolve = resolverFor({ 'down.example': { error: new Error('resolver unavailable') } });
  const doFetch = fetchStub(() => ok());
  const err = await captureWarnings(() => safeFetch('https://down.example/', {}, { resolve, fetch: doFetch })).catch((e) => e);
  assert.ok(err instanceof DnsResolutionError);
  assert.equal(doFetch.calls.length, 0);
  const event = JSON.parse(err.warnings[0]);
  assert.equal(event.event, 'ssrf_resolver_error');
  assert.equal(event.host, 'down.example');
});

test('fail closed: a resolver that never answers times out, aborts the lookup, and nothing is sent', async () => {
  const signals = [];
  const resolve = (host, type, signal) => { signals.push(signal); return new Promise(() => {}); }; // never settles
  const doFetch = fetchStub(() => ok());
  const started = Date.now();
  const err = await captureWarnings(() => safeFetch('https://hang.example/', {}, { resolve, fetch: doFetch, dnsTimeoutMs: 60 })).catch((e) => e);
  assert.ok(err instanceof DnsResolutionError);
  assert.ok(Date.now() - started < 1000, 'must not wait on a hung resolver');
  assert.equal(doFetch.calls.length, 0);
  assert.equal(signals.length, 2); // A and AAAA
  assert.ok(signals.every((sig) => sig.aborted), 'the lookups are aborted');
  const event = JSON.parse(err.warnings[0]);
  assert.equal(event.event, 'ssrf_resolver_error');
  assert.match(event.error, /timed out/);
});

test('a lookup that answers within the deadline is unaffected by the timeout', async () => {
  const resolve = async (host, type) => { await new Promise((r) => setTimeout(r, 20)); if (type === 'A') return [PUBLIC]; throw Object.assign(new Error('no records found'), { name: 'NotFound' }); };
  const res = await safeFetch('https://slow.example/', {}, { resolve, fetch: fetchStub(() => ok('fine')), dnsTimeoutMs: 500 });
  assert.equal(await res.text(), 'fine');
});

test('fail closed: with no resolver available at all the request is not sent', async () => {
  const doFetch = fetchStub(() => ok());
  assert.equal(typeof globalThis.Deno, 'undefined'); // Node: the default resolver cannot work
  await assert.rejects(() => safeFetch('https://example.com/', {}, { fetch: doFetch }), DnsResolutionError);
  assert.equal(doFetch.calls.length, 0);
});

test('a host with no records is an error, but a missing AAAA record alone is fine', async () => {
  const doFetch = fetchStub(() => ok('fine'));
  await assert.rejects(() => safeFetch('https://nowhere.example/', {}, { resolve: resolverFor({}), fetch: doFetch }), (e) => e instanceof DnsResolutionError && /did not resolve/.test(e.message));
  assert.equal(doFetch.calls.length, 0);
  const res = await safeFetch('https://v4only.example/', {}, { resolve: resolverFor({ 'v4only.example': { A: [PUBLIC] } }), fetch: doFetch });
  assert.equal(await res.text(), 'fine');
});

test('scheme, userinfo, port and method restrictions', async () => {
  const resolve = resolverFor({ 'example.com': { A: [PUBLIC] } });
  const doFetch = fetchStub(() => ok());
  for (const url of ['ftp://example.com/', 'file:///etc/passwd', 'https://user:pw@example.com/', 'https://user@example.com/', 'http://example.com:8080/', 'https://example.com:22/', 'https://example.com:6379/']) {
    await assert.rejects(() => safeFetch(url, {}, { resolve, fetch: doFetch }), SsrfError, url);
  }
  await assert.rejects(() => safeFetch('https://example.com/', { method: 'POST', body: 'x' }, { resolve, fetch: doFetch }), SsrfError);
  await assert.rejects(() => safeFetch('not a url', {}, { resolve, fetch: doFetch }), SsrfError);
  assert.equal(doFetch.calls.length, 0);
  for (const url of ['http://example.com/', 'https://example.com:443/', 'http://example.com:80/']) {
    await safeFetch(url, {}, { resolve, fetch: doFetch });
  }
  assert.equal(doFetch.calls.length, 3);
});

test('ssrf_block logs name only the host, never the path or query', async () => {
  const resolve = resolverFor({ 'bad.example': { A: ['10.0.0.1'] } });
  const err = await captureWarnings(() => safeFetch('https://bad.example/secret/path?token=abc123', {}, { resolve, fetch: fetchStub(() => ok()) })).catch((e) => e);
  const event = JSON.parse(err.warnings[0]);
  assert.equal(event.event, 'ssrf_block');
  assert.equal(event.host, 'bad.example');
  assert.ok(!err.warnings[0].includes('abc123') && !err.warnings[0].includes('secret/path'));
});

test('response size cap: declared length and streamed bytes', async () => {
  const resolve = resolverFor({ 'big.example': { A: [PUBLIC] } });
  await assert.rejects(
    () => safeFetch('https://big.example/', {}, { resolve, maxBytes: 1000, fetch: fetchStub(() => ok('x', { 'content-length': '5000' })) }),
    FetchLimitError,
  );
  const streamed = await safeFetch('https://big.example/', {}, { resolve, maxBytes: 1000, fetch: fetchStub(() => ok('y'.repeat(5000))) });
  await assert.rejects(() => streamed.text(), FetchLimitError);
  const small = await safeFetch('https://big.example/', {}, { resolve, maxBytes: 1000, fetch: fetchStub(() => ok('z'.repeat(900))) });
  assert.equal((await small.text()).length, 900);
});
