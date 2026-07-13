import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** Resolve the calling user from the request's Authorization header. */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

let secretCache: Record<string, string> = {};

/** Read a secret from Vault via the locked-down public.get_secret RPC. Cached per isolate. */
export async function getSecret(db: SupabaseClient, name: string): Promise<string | null> {
  if (secretCache[name]) return secretCache[name];
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error) {
    console.error(`get_secret(${name}) failed:`, error.message);
    return null;
  }
  if (data) secretCache[name] = data as string;
  return (data as string) ?? null;
}
