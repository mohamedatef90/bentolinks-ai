-- RefVault Phase 1: migrate legacy BentoLinks data
-- categories -> top-level folders; links -> content_items (+ item_folders)
-- Old tables are kept read-only until the Phase 2 cutover, then dropped.

-- 1) Category -> folder mapping
create temp table cat_map on commit drop as
select id as old_id, gen_random_uuid() as new_id
from public.categories;

insert into public.folders (id, user_id, name, color, icon, position)
select m.new_id, c.user_id, c.name, c.color, c.icon,
       row_number() over (partition by c.user_id order by c.name) - 1
from public.categories c
join cat_map m on m.old_id = c.id;

-- 2) Links -> content_items (dedup on naive canonical URL; keep pinned, then earliest)
with cleaned as (
  select l.*,
         regexp_replace(
           regexp_replace(
             regexp_replace(l.url, '[?&](utm_[a-zA-Z_]+|ref|source|share|fbclid|gclid)=[^&#]*', '', 'g'),
             '[?&]+(#|$)', '\1'
           ),
           '/+$', ''
         ) as canonical
  from public.links l
),
dedup as (
  select distinct on (user_id, canonical) *
  from cleaned
  order by user_id, canonical, is_pinned desc nulls last, created_at asc
)
insert into public.content_items
  (user_id, url, canonical_url, source_type, status, title, description,
   is_pinned, section, tags, created_at, raw_metadata)
select
  d.user_id,
  d.url,
  d.canonical,
  case
    when d.url ~* '(youtube\.com/watch|youtu\.be/|youtube\.com/shorts/)' then 'youtube'
    when d.url ~* 'instagram\.com/(reel|reels)/' then 'reel'
    when d.url ~* '(twitter|x)\.com/[^/]+/status/' then 'tweet'
    when d.url ~* 'reddit\.com/r/[^/]+/comments/' then 'reddit'
    when d.url ~* '\.pdf(\?|$)' then 'pdf'
    else 'article'
  end,
  'ready',
  d.title,
  nullif(d.description, ''),
  coalesce(d.is_pinned, false),
  nullif(d.section, ''),
  '{}',
  to_timestamp(d.created_at / 1000.0),
  jsonb_build_object(
    'legacy_id', d.id,
    'legacy_category_id', d.category_id,
    'migrated_at', now()
  )
from dedup d;

-- 3) Folder assignments from legacy category_id
insert into public.item_folders (item_id, folder_id, user_id)
select ci.id, m.new_id, ci.user_id
from public.content_items ci
join cat_map m on m.old_id = ci.raw_metadata ->> 'legacy_category_id'
where ci.raw_metadata ? 'legacy_category_id'
on conflict do nothing;
