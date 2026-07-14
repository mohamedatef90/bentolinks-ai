-- RefVault: track the client that saved each item (web / mobile / extension / import / rss)
-- Powers the "From your phone" home section + system smart collection.

alter table public.content_items
  add column if not exists saved_via text not null default 'web'
  constraint content_items_saved_via_check
  check (saved_via in ('web', 'mobile', 'extension', 'import', 'rss'));

-- Backfill: feed-ingested items are 'rss'; everything migrated/saved so far stays 'web'.
update public.content_items set saved_via = 'rss' where source_type = 'rss';

create index if not exists content_items_user_saved_via_idx
  on public.content_items (user_id, saved_via);

-- Extend the system collections seed with "From your phone".
create or replace function public.seed_system_collections(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.smart_collections (user_id, name, icon, position, is_system, query)
  values
    (uid, 'Inbox',           '📥', 0, true, '{"system":"inbox"}'),
    (uid, 'Reading Queue',   '⏳', 1, true, '{"system":"queue","read_status":["unread","reading"]}'),
    (uid, 'Starred',         '⭐', 2, true, '{"system":"starred","is_starred":true}'),
    (uid, 'Resurface',       '🔁', 3, true, '{"system":"resurface"}'),
    (uid, 'RSS',             '📡', 4, true, '{"system":"rss","source_type":["rss"]}'),
    (uid, 'From your phone', '📱', 5, true, '{"system":"mobile","saved_via":["mobile"]}')
  on conflict do nothing;
$$;

-- Seed the new collection for existing users.
insert into public.smart_collections (user_id, name, icon, position, is_system, query)
select u.id, 'From your phone', '📱', 5, true, '{"system":"mobile","saved_via":["mobile"]}'::jsonb
from auth.users u
where not exists (
  select 1 from public.smart_collections sc
  where sc.user_id = u.id and sc.is_system and sc.query ->> 'system' = 'mobile'
);
