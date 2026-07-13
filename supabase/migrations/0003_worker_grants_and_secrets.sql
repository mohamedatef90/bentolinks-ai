-- Service-role access to worker functions + Vault secret reader

grant execute on function public.claim_jobs(int) to service_role;
grant execute on function public.reclaim_stuck_jobs() to service_role;

-- Edge Functions read secrets from Vault through this wrapper.
-- PostgREST does not expose the vault schema, so we expose a locked-down reader.
create or replace function public.get_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name;
$$;

revoke all on function public.get_secret(text) from public, anon, authenticated;
grant execute on function public.get_secret(text) to service_role;
