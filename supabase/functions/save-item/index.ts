import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/db.ts';
import { canonicalizeUrl, detectSourceType, validatePublicUrl } from '../_shared/canonical.ts';
import { enqueue } from '../_shared/queue.ts';

interface SaveRequest {
  url?: string;
  urls?: string[]; // batch mode (bookmark import), max 100
  folder_id?: string;
  tags?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

  const user = await getUser(req);
  if (!user) return corsResponse({ error: 'UNAUTHORIZED' }, 401);

  let body: SaveRequest;
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'INVALID_REQUEST', message: 'Body must be JSON' }, 400);
  }

  const urls = body.urls ?? (body.url ? [body.url] : []);
  if (urls.length === 0) return corsResponse({ error: 'INVALID_REQUEST', message: 'url or urls required' }, 400);
  if (urls.length > 100) return corsResponse({ error: 'INVALID_REQUEST', message: 'Max 100 URLs per request' }, 400);

  const db = serviceClient();
  const isBatch = !!body.urls;
  const results: Array<Record<string, unknown>> = [];

  for (const raw of urls) {
    const check = validatePublicUrl(raw.trim());
    if (!check.ok) {
      results.push({ url: raw, error: 'INVALID_URL', message: check.reason });
      continue;
    }

    const canonical = canonicalizeUrl(raw.trim());
    const sourceType = detectSourceType(raw.trim());

    // Duplicate detection
    const { data: existing } = await db
      .from('content_items')
      .select('id, url, title, status, thumbnail_url, created_at')
      .eq('user_id', user.id)
      .eq('canonical_url', canonical)
      .maybeSingle();

    if (existing) {
      results.push({ ...existing, duplicate: true });
      continue;
    }

    const { data: item, error: insertError } = await db
      .from('content_items')
      .insert({
        user_id: user.id,
        url: raw.trim(),
        canonical_url: canonical,
        source_type: sourceType,
        status: 'pending',
        tags: (body.tags ?? []).slice(0, 10),
      })
      .select('id, url, title, status, source_type, created_at')
      .single();

    if (insertError || !item) {
      results.push({ url: raw, error: 'INTERNAL_ERROR', message: insertError?.message });
      continue;
    }

    if (body.folder_id) {
      await db.from('item_folders').insert({
        item_id: item.id,
        folder_id: body.folder_id,
        user_id: user.id,
      });
    }

    try {
      await enqueue(db, { user_id: user.id, item_id: item.id, job_type: 'parse' });
    } catch (e) {
      console.error('enqueue failed:', (e as Error).message);
    }

    results.push({ ...item, duplicate: false });
  }

  return corsResponse(isBatch ? { items: results } : results[0], 202);
});
