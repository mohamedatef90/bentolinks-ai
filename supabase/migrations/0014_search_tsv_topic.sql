-- Make the AI topic searchable so "search by topic or any word" works.
-- Rebuilds the generated search_tsv column to include `topic` (weight A).
drop index if exists content_items_search_idx;
alter table public.content_items drop column search_tsv;
alter table public.content_items
  add column search_tsv tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(topic, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', left(coalesce(content_text, ''), 100000)), 'C')
  ) stored;
create index content_items_search_idx on public.content_items using gin (search_tsv);
