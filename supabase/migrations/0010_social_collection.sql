-- RefVault: "Social" system collection — tweets, reels/TikToks, Reddit posts.
-- Same pattern as the other system collections (query jsonb, RLS select-own).

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
    (uid, 'From your phone', '📱', 5, true, '{"system":"mobile","saved_via":["mobile"]}'),
    (uid, 'Social',          '💬', 6, true, '{"system":"social","source_type":["tweet","reel","reddit"]}')
  on conflict do nothing;
$$;

-- Seed the new collection for existing users.
insert into public.smart_collections (user_id, name, icon, position, is_system, query)
select u.id, 'Social', '💬', 6, true, '{"system":"social","source_type":["tweet","reel","reddit"]}'::jsonb
from auth.users u
where not exists (
  select 1 from public.smart_collections sc
  where sc.user_id = u.id and sc.is_system and sc.query ->> 'system' = 'social'
);
