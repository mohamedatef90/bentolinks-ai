// SSRF-safe outbound fetching.
//
// Every fetch whose URL comes from a user, or from a third-party response, goes
// through `safeFetch`. It:
//   1. accepts only http/https, without userinfo, on port 80/443 (or the default);
//   2. resolves the hostname (A and AAAA) and refuses the request when ANY
//      resolved address is non-public, or when the lookup itself fails
//      (fail closed: an unavailable resolver blocks fetching, it never allows it);
//   3. follows redirects manually, at most `maxRedirects` hops, and repeats steps
//      1-2 for every hop;
//   4. caps the response body size.
//
// Known residual risk (accepted, see the PR): DNS rebinding between our lookup and
// the lookup `fetch` performs itself, because Deno `fetch` cannot pin an address.
// Re-validating every redirect hop and the short per-site timeouts narrow it.
//
// This module has no imports and reads `Deno` lazily, so it can be unit-tested in
// plain Node with an injected resolver and fetch.

// ---- errors ---------------------------------------------------------------------

/** The request was refused because the target is not a public web address. */
export class SsrfError extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = 'SsrfError';
    this.reason = reason;
  }
}

/** The hostname could not be resolved (or the resolver failed). Nothing was fetched. */
export class DnsResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DnsResolutionError';
  }
}

/** The response exceeded the size cap. */
export class FetchLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchLimitError';
  }
}

// ---- IP classification ------------------------------------------------------------

function parseIPv4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  let value = 0;
  for (let i = 1; i <= 4; i++) {
    const part = m[i];
    // Leading zeros are ambiguous (octal in some parsers): treat as invalid.
    if (part.length > 1 && part.startsWith('0')) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** [network, prefixLength, label] */
const BLOCKED_V4: Array<[string, number, string]> = [
  ['0.0.0.0', 8, 'this-network'],
  ['10.0.0.0', 8, 'private'],
  ['100.64.0.0', 10, 'cgnat'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local'],
  ['172.16.0.0', 12, 'private'],
  ['192.0.0.0', 24, 'ietf-protocol'],
  ['192.0.2.0', 24, 'documentation'],
  ['192.168.0.0', 16, 'private'],
  ['198.18.0.0', 15, 'benchmark'],
  ['198.51.100.0', 24, 'documentation'],
  ['203.0.113.0', 24, 'documentation'],
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved'],
];

function classifyV4(value: number): { public: boolean; reason?: string } {
  for (const [net, bits, label] of BLOCKED_V4) {
    const base = parseIPv4(net)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if (((value & mask) >>> 0) === ((base & mask) >>> 0)) return { public: false, reason: label };
  }
  return { public: true };
}

/** Parse an IPv6 literal (no brackets, no zone id) into eight 16-bit words. */
function parseIPv6(input: string): number[] | null {
  let s = input;
  if (s.includes('%')) return null; // zone ids are never public
  // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toWords = (part: string): number[] | null => {
    if (part === '') return [];
    const out: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = toWords(halves[0]);
  if (!head) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const rest = toWords(halves[1]);
  if (!rest) return null;
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array(missing).fill(0), ...rest];
}

function v4FromWords(hi: number, lo: number): number {
  return ((hi << 16) | lo) >>> 0;
}

/**
 * Classify an IP literal. Anything that does not parse is treated as non-public.
 * Accepts IPv4, IPv6, and bracketed IPv6 (as found in `URL.hostname`).
 */
export function classifyIp(raw: string): { public: boolean; reason?: string } {
  const ip = raw.trim().replace(/^\[|\]$/g, '');
  const v4 = parseIPv4(ip);
  if (v4 !== null) return classifyV4(v4);
  if (!ip.includes(':')) return { public: false, reason: 'invalid-address' };
  const w = parseIPv6(ip);
  if (!w) return { public: false, reason: 'invalid-address' };

  // ::/96 covers `::`, `::1` and deprecated IPv4-compatible addresses.
  if (w.slice(0, 6).every((x) => x === 0)) return { public: false, reason: 'unspecified-or-loopback' };
  // IPv4-mapped ::ffff:a.b.c.d -> judge the embedded IPv4 address.
  if (w.slice(0, 5).every((x) => x === 0) && w[5] === 0xffff) return classifyV4(v4FromWords(w[6], w[7]));
  // IPv4-translated ::ffff:0:a.b.c.d (RFC 2765, ::ffff:0:0/96) -> judge the embedded IPv4 address.
  if (w.slice(0, 4).every((x) => x === 0) && w[4] === 0xffff && w[5] === 0) return classifyV4(v4FromWords(w[6], w[7]));
  // The rest of ::/8 is reserved space, never a public host.
  if ((w[0] & 0xff00) === 0) return { public: false, reason: 'reserved' };
  if (w[0] === 0x0064 && w[1] === 0xff9b) return { public: false, reason: 'nat64' };
  if (w[0] === 0x0100 && w[1] === 0 && w[2] === 0 && w[3] === 0) return { public: false, reason: 'discard' };
  if ((w[0] & 0xfe00) === 0xfc00) return { public: false, reason: 'unique-local' };
  if ((w[0] & 0xffc0) === 0xfe80) return { public: false, reason: 'link-local' };
  if ((w[0] & 0xffc0) === 0xfec0) return { public: false, reason: 'site-local' };
  if ((w[0] & 0xff00) === 0xff00) return { public: false, reason: 'multicast' };
  if (w[0] === 0x2001 && w[1] === 0) return { public: false, reason: 'teredo' };
  if (w[0] === 0x2001 && w[1] === 0x0db8) return { public: false, reason: 'documentation' };
  // 6to4 embeds an IPv4 address in words 1-2.
  if (w[0] === 0x2002) return classifyV4(v4FromWords(w[1], w[2]));
  return { public: true };
}

export function isPublicIp(ip: string): boolean {
  return classifyIp(ip).public;
}

// ---- hostname checks --------------------------------------------------------------

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

/** True for an IP literal (v4, or bracketed/unbracketed v6) as `new URL(...).hostname` yields it. */
export function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  return parseIPv4(h) !== null || h.includes(':');
}

/** Cheap, synchronous check on a hostname: names that are local by definition, and non-public IP literals. */
export function checkHostname(hostname: string): { ok: true } | { ok: false; reason: string } {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, reason: 'empty-host' };
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'local-name' };
  }
  if (isIpLiteral(host)) {
    const c = classifyIp(host);
    if (!c.public) return { ok: false, reason: c.reason ?? 'non-public-address' };
  }
  return { ok: true };
}

// ---- DNS resolution ---------------------------------------------------------------

export type Resolver = (hostname: string, type: 'A' | 'AAAA', signal?: AbortSignal) => Promise<string[]>;

/** Each DNS lookup gets this long before the request is refused (fail closed). */
export const DNS_TIMEOUT_MS = 5_000;

const defaultResolver: Resolver = (hostname, type, signal) => {
  // deno-lint-ignore no-explicit-any
  const deno = (globalThis as any).Deno;
  if (!deno || typeof deno.resolveDns !== 'function') {
    return Promise.reject(new Error('Deno.resolveDns is not available'));
  }
  return deno.resolveDns(hostname, type, { signal });
};

/** Run one lookup with a deadline. A resolver that never answers cannot stall the caller. */
function resolveWithTimeout(resolve: Resolver, host: string, type: 'A' | 'AAAA', timeoutMs: number): Promise<string[]> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`DNS lookup timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  return Promise.race([resolve(host, type, controller.signal), deadline]).finally(() => clearTimeout(timer));
}

function isNoRecords(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return e?.name === 'NotFound' || /no (records?|data|address)|nxdomain|not ?found/i.test(e?.message ?? '');
}

function log(event: 'ssrf_block' | 'ssrf_resolver_error', fields: Record<string, unknown>) {
  // Structured, single-line JSON; hostnames only (never full URLs, which can carry tokens).
  console.warn(JSON.stringify({ event, ...fields }));
}

/** Resolve A and AAAA. Fails closed: any unexpected resolver error, or no addresses at all, throws. */
async function resolveAll(host: string, resolve: Resolver, timeoutMs: number): Promise<string[]> {
  const settled = await Promise.allSettled([
    resolveWithTimeout(resolve, host, 'A', timeoutMs),
    resolveWithTimeout(resolve, host, 'AAAA', timeoutMs),
  ]);
  const addresses: string[] = [];
  const hard: string[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') addresses.push(...r.value);
    else if (!isNoRecords(r.reason)) hard.push((r.reason as Error)?.message ?? String(r.reason));
  }
  if (hard.length > 0) {
    log('ssrf_resolver_error', { host, error: hard[0].slice(0, 200) });
    throw new DnsResolutionError('DNS lookup failed; the request was not sent');
  }
  if (addresses.length === 0) throw new DnsResolutionError('The host did not resolve');
  return addresses;
}

// ---- URL validation ----------------------------------------------------------------

function block(reason: string, host: string, hop: number, message: string): never {
  log('ssrf_block', { reason, host, hop });
  throw new SsrfError(reason, message);
}

/** Validate a single URL (scheme, userinfo, port, host, resolved addresses). Throws SsrfError or DnsResolutionError. */
export async function assertSafeUrl(url: URL, resolve: Resolver = defaultResolver, hop = 0, dnsTimeoutMs = DNS_TIMEOUT_MS): Promise<void> {
  const host = url.hostname;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') block('scheme', host, hop, 'Only http/https URLs are allowed');
  if (url.username || url.password) block('userinfo', host, hop, 'URLs with credentials are not allowed');
  if (url.port && url.port !== '80' && url.port !== '443') block('port', host, hop, 'Only the standard web ports are allowed');
  const named = checkHostname(host);
  if (!named.ok) block(named.reason, host, hop, 'Private or local addresses are not allowed');
  if (isIpLiteral(host)) return; // already classified above

  const addresses = await resolveAll(host.toLowerCase().replace(/\.$/, ''), resolve, dnsTimeoutMs);
  for (const address of addresses) {
    const c = classifyIp(address);
    if (!c.public) block(`resolved-${c.reason ?? 'non-public'}`, host, hop, 'The host resolves to a private or local address');
  }
}

// ---- safeFetch ---------------------------------------------------------------------

export interface SafeFetchOptions {
  /** Redirect hops to follow (default 5). Each hop is fully re-validated. */
  maxRedirects?: number;
  /** Response body cap in bytes (default 15 MB). */
  maxBytes?: number;
  /** Per-lookup DNS deadline in ms (default 5000). */
  dnsTimeoutMs?: number;
  /** Test seams. */
  resolve?: Resolver;
  fetch?: typeof fetch;
}

export const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function capBody(res: Response, finalUrl: string, maxBytes: number): Response {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    res.body?.cancel().catch(() => {});
    throw new FetchLimitError(`Response exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
  }
  let capped = res;
  if (res.body) {
    let total = 0;
    const limited = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          total += chunk.byteLength;
          if (total > maxBytes) controller.error(new FetchLimitError(`Response exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`));
          else controller.enqueue(chunk);
        },
      }),
    );
    capped = new Response(limited, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
  // `url` is read-only on Response; expose the URL of the last hop so callers can read it.
  Object.defineProperty(capped, 'url', { value: finalUrl });
  return capped;
}

/**
 * fetch() for URLs that are not under our control. GET/HEAD only.
 * Throws SsrfError (blocked target / too many redirects), DnsResolutionError
 * (lookup failed, nothing sent) or FetchLimitError (body too large).
 */
export async function safeFetch(input: string | URL, init: RequestInit = {}, opts: SafeFetchOptions = {}): Promise<Response> {
  const resolve = opts.resolve ?? defaultResolver;
  const doFetch = opts.fetch ?? fetch;
  const maxRedirects = opts.maxRedirects ?? 5;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') throw new SsrfError('method', 'Only GET and HEAD are allowed');

  let current: URL;
  try {
    current = input instanceof URL ? new URL(input.toString()) : new URL(input);
  } catch {
    throw new SsrfError('invalid-url', 'Not a valid URL');
  }
  const headers = new Headers(init.headers);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(current, resolve, hop, opts.dnsTimeoutMs ?? DNS_TIMEOUT_MS);
    const res = await doFetch(current.toString(), { ...init, method, headers, redirect: 'manual' });

    const location = res.headers.get('location');
    if (!REDIRECT_STATUSES.has(res.status) || !location) return capBody(res, current.toString(), maxBytes);

    await res.body?.cancel().catch(() => {});
    if (hop === maxRedirects) block('too-many-redirects', current.hostname, hop, `More than ${maxRedirects} redirects`);

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      block('bad-redirect', current.hostname, hop, 'Invalid redirect target');
    }
    if (next.origin !== current.origin) {
      headers.delete('authorization');
      headers.delete('cookie');
    }
    current = next;
  }
  // Unreachable: the loop always returns or throws.
  throw new SsrfError('too-many-redirects', `More than ${maxRedirects} redirects`);
}
