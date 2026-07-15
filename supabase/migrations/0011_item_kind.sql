-- Differentiate the two kinds of saved links so the UI can route them:
--   'bookmark' -> a plain website link with no readable body  (Vault Hub)
--   'content'  -> an article / social post / video / pdf / feed (Library)
--
-- Computed by Postgres as a STORED generated column so it self-updates the
-- moment the enrich pipeline fills in word_count/summary/content_text, and so
-- every client (web + future Linkat mobile) shares one classification.
--
-- Rich source types are ALWAYS content (a video is content even if we couldn't
-- transcribe it; a tweet is a social post; rss has its own Feeds surface and
-- must never leak into the bookmark hub). Generic article/other links become
-- content only once real readable text was extracted, otherwise they stay a
-- bookmark — which is exactly what the 979 migrated BentoLinks links are.

alter table content_items
  add column if not exists item_kind text
  generated always as (
    case
      when source_type in ('youtube', 'reel', 'tweet', 'reddit', 'pdf', 'podcast', 'rss') then 'content'
      when coalesce(word_count, 0) >= 120 then 'content'
      when summary is not null and length(summary) > 0 then 'content'
      when content_text is not null and length(content_text) >= 200 then 'content'
      else 'bookmark'
    end
  ) stored;

create index if not exists content_items_user_kind_idx
  on content_items (user_id, item_kind, created_at desc);
