import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/db.ts';
import { canonicalizeUrl, detectSourceType, inferItemKind, validatePublicUrl } from '../_shared/canonical.ts';
import { enqueue } from '../_shared/queue.ts';

const SAVED_VIA = ['web', 'mobile', 'extension', 'import'] as const;
const ITEM_KINDS = ['bookmark', 'content'] as const;
const DESTINATIONS = ['auto', ...ITEM_KINDS] as const;

interface SaveRequest {
  url?: string;
  urls?: string[]; // batch mode (bookmark import), max 100
  folder_id?: string;
  tags?: string[];
  /** Backwards-compatible explicit destination. Prefer `destination`. */
  kind?: (typeof ITEM_KINDS)[number];
  /** Auto classifies domain→Bookmarks and articles/social/files→Reading. */
  destination?: (typeof DESTINATIONS)[number];
  saved_via?: (typeof SAVED_VIA)[number]; // client origin; defaults to 'web'
  note?: string;
  retry_item_id?: string; // re-enqueue the parse pipeline for an existing item
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

  // Retry mode: re-run the parse pipeline for an item the user already owns
  // (used by the card "re-fetch" button when the AI couldn't extract data).
  if (body.retry_item_id) {
    const db = serviceClient();
    const { data: item } = await db
      .from('content_items')
      .select('id')
      .eq('id', body.retry_item_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!item) return corsResponse({ error: 'NOT_FOUND', message: 'Item not found' }, 404);

    await db.from('content_items').update({ status: 'pending' }).eq('id', item.id);
    try {
      await enqueue(db, { user_id: user.id, item_id: item.id, job_type: 'parse' });
    } catch (e) {
      return corsResponse({ error: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
    }
    return corsResponse({ id: item.id, status: 'pending', retried: true }, 202);
  }

  const urls = body.urls ?? (body.url ? [body.url] : []);
  if (urls.length === 0) return corsResponse({ error: 'INVALID_REQUEST', message: 'url or urls required' }, 400);
  if (urls.length > 100) return corsResponse({ error: 'INVALID_REQUEST', message: 'Max 100 URLs per request' }, 400);

  const db = serviceClient();
  const isBatch = !!body.urls;
  const savedVia = SAVED_VIA.includes(body.saved_via as (typeof SAVED_VIA)[number])
    ? body.saved_via!
    : isBatch ? 'import' : 'web';
  const requestedDestination = DESTINATIONS.includes(body.destination as (typeof DESTINATIONS)[number])
    ? body.destination!
    : ITEM_KINDS.includes(body.kind as (typeof ITEM_KINDS)[number])
      ? body.kind!
      : isBatch ? 'bookmark' : 'auto';
  const captureNote = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const results: Array<Record<string, unknown>> = [];

  let folderId: string | null = null;
  if (body.folder_id) {
    const { data: folder } = await db
      .from('folders')
      .select('id')
      .eq('id', body.folder_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!folder) return corsResponse({ error: 'INVALID_FOLDER', message: 'Folder not found' }, 400);
    folderId = folder.id;
  }

  for (const raw of urls) {
    const check = validatePublicUrl(raw.trim());
    if (!check.ok) {
      results.push({ url: raw, error: 'INVALID_URL', message: check.reason });
      continue;
    }

    const canonical = canonicalizeUrl(raw.trim());
    const sourceType = detectSourceType(raw.trim());
    // Stamp the routing decision at capture time. Parsing/enrichment may add a
    // large body later, but that must never turn a domain home page into an
    // article. Explicit user choice always wins over automatic inference.
    const kindOverride = requestedDestination === 'auto'
      ? inferItemKind(raw.trim(), sourceType)
      : requestedDestination;

    // Duplicate detection
    const { data: existing } = await db
      .from('content_items')
      .select('id, url, title, status, thumbnail_url, created_at')
      .eq('user_id', user.id)
      .eq('canonical_url', canonical)
      .maybeSingle();

    if (existing) {
      await db.from('content_items').update({ kind_override: kindOverride }).eq('id', existing.id);
      if (folderId) {
        await db.from('item_folders').delete().eq('item_id', existing.id);
        await db.from('item_folders').insert({
          item_id: existing.id,
          folder_id: folderId,
          user_id: user.id,
          assignment_source: 'user',
        });
      }
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
        kind_override: kindOverride,
        status: 'pending',
        saved_via: savedVia,
        tags: (body.tags ?? []).slice(0, 10),
        raw_metadata: captureNote ? { capture_note: captureNote } : null,
      })
      .select('id, url, title, status, source_type, created_at')
      .single();

    if (insertError || !item) {
      results.push({ url: raw, error: 'INTERNAL_ERROR', message: insertError?.message });
      continue;
    }

    if (folderId) {
      await db.from('item_folders').insert({
        item_id: item.id,
        folder_id: folderId,
        user_id: user.id,
        assignment_source: 'user',
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
