// Personal API key auth for the MCP server. Keys are "rv_" + 24 random bytes
// (hex), stored only as a sha-256 hash (see migration 0013). An agent sends the
// full key as `Authorization: Bearer rv_...`; we hash it and look up the row.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** sha-256 of `input`, lowercase hex — matches the pgcrypto digest stored by create_api_key. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ResolvedKey {
  userId: string;
  keyId: string;
}

/** Resolve `Authorization: Bearer rv_...` to a user, or null if invalid/revoked. */
export async function resolveApiKey(
  db: SupabaseClient,
  authHeader: string | null,
): Promise<ResolvedKey | null> {
  const m = /^Bearer\s+(rv_[0-9a-f]{20,})$/i.exec((authHeader ?? '').trim());
  if (!m) return null;

  const hash = await sha256Hex(m[1]);
  const { data } = await db
    .from('api_keys')
    .select('id, user_id, last_used_at')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .maybeSingle();
  if (!data) return null;

  // Best-effort last_used_at bump, throttled to once/60s (avoids a write per call).
  const stale = !data.last_used_at || Date.now() - Date.parse(data.last_used_at as string) > 60_000;
  if (stale) {
    await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  }
  return { userId: data.user_id as string, keyId: data.id as string };
}
