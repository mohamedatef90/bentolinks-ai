-- RefVault Phase 4: pgvector semantic search
-- 1. HNSW cosine index on content_items.embedding (768d, written by 'embed' jobs)
-- 2. match_items()  — vector search, SECURITY INVOKER so RLS scopes rows to the caller
-- 3. Backfill: enqueue 'embed' jobs for existing ready items
-- Keyword FTS reuses Phase 2's existing search_items(q, filters); semantic-search
-- RRF-merges the two arms.

-- 1. Index ---------------------------------------------------------------------
create index if not exists content_items_embedding_idx
  on public.content_items
  using hnsw (embedding extensions.vector_cosine_ops);

-- 2. Vector search --------------------------------------------------------------
create or replace function public.match_items(
  query_embedding extensions.vector(768),
  match_count int default 10
)
returns table (
  id uuid,
  title text,
  url text,
  summary text,
  source_type text,
  thumbnail_url text,
  favicon_url text,
  tags text[],
  created_at timestamptz,
  similarity double precision
)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select ci.id, ci.title, ci.url, ci.summary, ci.source_type,
         ci.thumbnail_url, ci.favicon_url, ci.tags, ci.created_at,
         (1 - (ci.embedding <=> query_embedding))::double precision as similarity
  from public.content_items ci
  where ci.embedding is not null
  order by ci.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.match_items(extensions.vector, int) from public, anon;
grant execute on function public.match_items(extensions.vector, int) to authenticated;

-- 3. Backfill ---------------------------------------------------------------------
-- Single guarded INSERT..SELECT: at current row counts one statement is the batch.
-- The cron worker drains these at ~5 jobs/minute.
insert into public.jobs (user_id, item_id, job_type)
select ci.user_id, ci.id, 'embed'
from public.content_items ci
where ci.status = 'ready'
  and ci.summary is not null
  and ci.embedding is null
  and not exists (
    select 1 from public.jobs j
    where j.item_id = ci.id
      and j.job_type = 'embed'
      and j.status in ('queued', 'running')
  );
