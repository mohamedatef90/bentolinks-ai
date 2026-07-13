// Hybrid search: embed the query, run pgvector match_items + Phase 2's keyword
// search_items (both RLS-scoped to the caller), merge via Reciprocal Rank Fusion.
// Returns a single ranked list the web UI renders as "semantic matches".

import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { serviceClient, userClient, getUser, getSecret } from '../_shared/db.ts';
import { embedText } from '../_shared/gemini.ts';

const RRF_K = 60; // standard RRF damping constant
const CANDIDATES = 20;

interface Row {
  id: string;
  title: string | null;
  url: string;
  summary: string | null;
  source_type: string;
  thumbnail_url: string | null;
  favicon_url: string | null;
  tags: string[] | null;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

  const user = await getUser(req);
  if (!user) return corsResponse({ error: 'UNAUTHORIZED' }, 401);

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'INVALID_REQUEST', message: 'Body must be JSON' }, 400);
  }
  const query = (body.query ?? '').trim();
  if (!query) return corsResponse({ error: 'INVALID_REQUEST', message: 'query required' }, 400);
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

  const db = userClient(req); // RLS-scoped
  const ranks = new Map<string, number>();
  const rows = new Map<string, Row>();

  const fuse = (list: Row[] | null) => {
    (list ?? []).forEach((row, i) => {
      rows.set(row.id, row);
      ranks.set(row.id, (ranks.get(row.id) ?? 0) + 1 / (RRF_K + i + 1));
    });
  };

  // Keyword arm — reuse Phase 2's search_items (RLS-scoped, rank-ordered).
  const { data: ftsRows, error: ftsErr } = await db.rpc('search_items', {
    q: query,
    filters: {},
  });
  if (ftsErr) console.error('search_items failed:', ftsErr.message);
  fuse(((ftsRows as Row[] | null) ?? []).slice(0, CANDIDATES));

  // Semantic arm — best-effort; if embedding fails we still return keyword results.
  let semanticUsed = false;
  try {
    const key = await getSecret(serviceClient(), 'GEMINI_API_KEY');
    if (key) {
      const vector = await embedText(key, query, 'RETRIEVAL_QUERY');
      const { data: vecRows, error: vecErr } = await db.rpc('match_items', {
        query_embedding: JSON.stringify(vector),
        match_count: CANDIDATES,
      });
      if (vecErr) {
        console.error('match_items failed:', vecErr.message);
      } else {
        fuse(vecRows as Row[] | null);
        semanticUsed = true;
      }
    }
  } catch (e) {
    console.error('semantic arm failed:', (e as Error).message);
  }

  const results = [...ranks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({ ...rows.get(id)!, score }));

  return corsResponse({ query, semantic: semanticUsed, count: results.length, results });
});
