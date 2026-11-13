-- Defense in depth for folder tenancy.
--
-- Edge Functions use the service-role key (RLS bypass) and RLS on item_folders
-- only checks the row's own user_id, so a caller-supplied folder_id / parent_id /
-- item_id could previously point at another account's row. The Edge Functions now
-- verify ownership; these triggers make the database reject it regardless of the
-- code path (service role, web client, future functions).
--
-- Both functions are SECURITY DEFINER with an empty search_path so the lookups
-- see every row (an RLS-filtered lookup would find nothing for a foreign row and
-- wrongly let it through). A missing referenced row is left to the existing
-- foreign keys to reject.

create or replace function public.enforce_folder_parent_tenancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_owner uuid;
begin
  if new.parent_id is not null then
    select f.user_id into parent_owner from public.folders f where f.id = new.parent_id;
    if parent_owner is not null and parent_owner <> new.user_id then
      raise exception 'FOLDER_TENANCY_VIOLATION: parent folder belongs to another user'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_item_folder_tenancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_owner uuid;
  folder_owner uuid;
begin
  select i.user_id into item_owner from public.content_items i where i.id = new.item_id;
  select f.user_id into folder_owner from public.folders f where f.id = new.folder_id;
  if (item_owner is not null and item_owner <> new.user_id)
     or (folder_owner is not null and folder_owner <> new.user_id) then
    raise exception 'FOLDER_TENANCY_VIOLATION: item and folder must belong to the same user as the row'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_folder_parent_tenancy() from public, anon, authenticated;
revoke all on function public.enforce_item_folder_tenancy() from public, anon, authenticated;

drop trigger if exists folders_parent_tenancy_check on public.folders;
create trigger folders_parent_tenancy_check
  before insert or update of parent_id, user_id on public.folders
  for each row execute function public.enforce_folder_parent_tenancy();

drop trigger if exists item_folders_tenancy_check on public.item_folders;
create trigger item_folders_tenancy_check
  before insert or update of item_id, folder_id, user_id on public.item_folders
  for each row execute function public.enforce_item_folder_tenancy();
