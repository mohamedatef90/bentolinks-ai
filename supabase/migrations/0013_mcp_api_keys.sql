-- MCP server auth: personal API keys ("rv_" + 24 random bytes hex), stored only
-- as a sha-256 hash. An AI agent (Claude, Codex, etc.) authenticates to the
-- `mcp` Edge Function with `Authorization: Bearer rv_...`; the function resolves
-- the key → user_id and scopes every query to that user.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,          -- display only, e.g. "rv_1a2b3c4d"
  key_hash text not null unique,     -- sha-256 hex of the full key
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.api_keys enable row level security;
create policy "api_keys_select_own" on public.api_keys for select using (user_id = auth.uid());
create policy "api_keys_update_own" on public.api_keys for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "api_keys_delete_own" on public.api_keys for delete using (user_id = auth.uid());
-- No insert policy: keys are minted only via create_api_key() so the plaintext
-- exists exactly once (in that call's return value) and never reaches a client insert.

-- Even the owner can never read key_hash back — only the non-secret columns.
revoke select on public.api_keys from authenticated;
grant select (id, user_id, name, key_prefix, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;

create index if not exists api_keys_hash_idx on public.api_keys (key_hash);
create index if not exists api_keys_user_idx on public.api_keys (user_id, created_at desc);

-- Mint a personal API key: returns the plaintext exactly once; only the hash is
-- stored. Server-side entropy via pgcrypto (installed in the extensions schema).
create or replace function public.create_api_key(key_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_key text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  raw_key := 'rv_' || encode(gen_random_bytes(24), 'hex');
  insert into public.api_keys (user_id, name, key_prefix, key_hash)
  values (
    auth.uid(),
    coalesce(nullif(trim(key_name), ''), 'API key'),
    left(raw_key, 11),
    encode(digest(raw_key, 'sha256'), 'hex')
  );
  return raw_key;
end;
$$;
revoke all on function public.create_api_key(text) from public, anon;
grant execute on function public.create_api_key(text) to authenticated;

-- Let the MCP server stamp saved_via='mcp' for provenance.
alter table public.content_items drop constraint if exists content_items_saved_via_check;
alter table public.content_items add constraint content_items_saved_via_check
  check (saved_via = any (array['web','mobile','extension','import','rss','mcp']));
