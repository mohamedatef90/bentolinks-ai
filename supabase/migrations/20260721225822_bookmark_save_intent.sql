-- A captured website is a bookmark unless the client explicitly saves it as
-- Reading. Keep that intent independently from parser output: enrichment can
-- add a body and an AI summary without moving the item out of Bookmarks.

alter table public.content_items
  add column if not exists kind_override text
  check (kind_override in ('bookmark', 'content'));

drop index if exists public.content_items_user_kind_idx;

alter table public.content_items
  drop column if exists item_kind;

alter table public.content_items
  add column item_kind text
  generated always as (
    case
      when kind_override is not null then kind_override
      when source_type in ('youtube', 'reel', 'tweet', 'reddit', 'pdf', 'podcast', 'rss') then 'content'
      when coalesce(word_count, 0) >= 120 then 'content'
      when content_text is not null and length(content_text) >= 200 then 'content'
      else 'bookmark'
    end
  ) stored;

create index content_items_user_kind_idx
  on public.content_items (user_id, item_kind, created_at desc);
