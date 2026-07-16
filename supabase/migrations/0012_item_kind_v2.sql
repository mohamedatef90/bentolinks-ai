-- item_kind v2: an AI summary no longer promotes a link to 'content'.
--
-- The enrich pipeline now runs on EVERY item — including metadata-only
-- bookmarks — so plain website links get an AI title + summary too. That makes
-- "summary is present" useless as a content signal: with the v1 rule every
-- enriched bookmark would silently migrate from the Vault Hub into the
-- Library. Content is now strictly: rich source type OR real extracted body.

drop index if exists content_items_user_kind_idx;
alter table content_items drop column if exists item_kind;

alter table content_items
  add column item_kind text
  generated always as (
    case
      when source_type in ('youtube', 'reel', 'tweet', 'reddit', 'pdf', 'podcast', 'rss') then 'content'
      when coalesce(word_count, 0) >= 120 then 'content'
      when content_text is not null and length(content_text) >= 200 then 'content'
      else 'bookmark'
    end
  ) stored;

create index content_items_user_kind_idx
  on content_items (user_id, item_kind, created_at desc);
