/** Common result shape for all source-type parsers (superset of ParsedArticle). */
export interface ParsedContent {
  title: string | null;
  description: string | null;
  author: string | null;
  site_name: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  published_at: string | null;
  content_text: string | null;
  word_count: number | null;
  duration_seconds?: number | null;
  raw_metadata?: Record<string, unknown> | null;
}

export const PARSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 RefVault/1.0';

export function wordCount(text: string | null): number | null {
  return text ? text.trim().split(/\s+/).length : null;
}
