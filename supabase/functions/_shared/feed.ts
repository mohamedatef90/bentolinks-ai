// RSS 2.0 / Atom / RSS 1.0 (RDF) feed parsing on top of fast-xml-parser.
// Shared by rss-poller (ingestion) and discover-feed (validation).

import { XMLParser } from 'npm:fast-xml-parser@4';

export interface FeedEntry {
  title: string | null;
  link: string;
  published_at: string | null;
  description: string | null;
}

export interface ParsedFeed {
  title: string | null;
  site_url: string | null;
  entries: FeedEntry[];
}

/** fast-xml-parser values can be strings or {'#text': ...} when attributes exist. */
function text(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    return text((v as Record<string, unknown>)['#text']);
  }
  return null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  const out = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) =>
      ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' })[m] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return out ? out.slice(0, 500) : null;
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return isNaN(t) ? null : new Date(t).toISOString();
}

/** Atom <link> can be one or many {@_href, @_rel}; prefer rel="alternate". */
function atomLink(link: unknown): string | null {
  const links = asArray(link) as Array<Record<string, unknown>>;
  const byRel = (rel: string | undefined) =>
    links.find((l) => l && typeof l === 'object' && l['@_rel'] === rel)?.['@_href'];
  const href = byRel('alternate') ??
    links.find((l) => l && typeof l === 'object' && !l['@_rel'])?.['@_href'] ??
    links[0]?.['@_href'];
  return typeof href === 'string' && href ? href : null;
}

export function parseFeed(xml: string): ParsedFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false, // keep values as strings; we parse dates/numbers ourselves
  });
  const doc = parser.parse(xml);

  // RSS 2.0 / 0.9x
  const channel = doc?.rss?.channel;
  if (channel) {
    const entries: FeedEntry[] = asArray(channel.item).map((item: any) => {
      const link = text(item.link) ??
        (item.guid && item.guid['@_isPermaLink'] !== 'false' ? text(item.guid) : null);
      return {
        title: text(item.title),
        link: link ?? '',
        published_at: parseDate(text(item.pubDate) ?? text(item['dc:date'])),
        description: stripHtml(text(item.description) ?? text(item['content:encoded'])),
      };
    }).filter((e: FeedEntry) => !!e.link);
    return { title: text(channel.title), site_url: text(channel.link), entries };
  }

  // Atom
  const feed = doc?.feed;
  if (feed) {
    const entries: FeedEntry[] = asArray(feed.entry).map((entry: any) => ({
      title: text(entry.title),
      link: atomLink(entry.link) ?? '',
      published_at: parseDate(text(entry.published) ?? text(entry.updated)),
      description: stripHtml(text(entry.summary) ?? text(entry.content)),
    })).filter((e: FeedEntry) => !!e.link);
    return { title: text(feed.title), site_url: atomLink(feed.link), entries };
  }

  // RSS 1.0 (RDF)
  const rdf = doc?.['rdf:RDF'];
  if (rdf) {
    const entries: FeedEntry[] = asArray(rdf.item).map((item: any) => ({
      title: text(item.title),
      link: text(item.link) ?? '',
      published_at: parseDate(text(item['dc:date'])),
      description: stripHtml(text(item.description)),
    })).filter((e: FeedEntry) => !!e.link);
    return { title: text(rdf.channel?.title), site_url: text(rdf.channel?.link), entries };
  }

  throw new Error('Not a recognizable RSS/Atom feed');
}
