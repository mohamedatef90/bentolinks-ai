-- Fixes from Supabase security advisors:
-- 1. Pin search_path on set_updated_at
-- 2. Revoke public execution of SECURITY DEFINER trigger/seed functions
--    (triggers still fire; they don't need caller EXECUTE privilege)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.check_folder_depth() from public, anon, authenticated;
revoke all on function public.handle_new_user_collections() from public, anon, authenticated;
revoke all on function public.seed_system_collections(uuid) from public, anon, authenticated;
