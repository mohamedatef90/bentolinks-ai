-- RefVault Phase 2: keyword search RPC over content_items.search_tsv
-- SECURITY INVOKER (default) + explicit auth.uid() filter so RLS always applies.
create or replace function public.search_items(q text default '', filters jsonb default '{}'::jsonb)
returns table (
  id uuid,
  url text,
  title text,
  description text,
  summary text,
  key_points jsonb,
  tags text[],
  topic text,
  source_type text,
  status text,
  site_name text,
  thumbnail_url text,
  favicon_url text,
  is_pinned boolean,
  is_starred boolean,
  read_status text,
  section text,
  created_at timestamptz,
  rank real
)
language sql
stable
set search_path = public
as $$
  select
    ci.id, ci.url, ci.title, ci.description, ci.summary, ci.key_points,
    ci.tags, ci.topic, ci.source_type, ci.status, ci.site_name,
    ci.thumbnail_url, ci.favicon_url, ci.is_pinned, ci.is_starred,
    ci.read_status, ci.section, ci.created_at,
    case
      when q is null or btrim(q) = '' then 0
      else ts_rank(ci.search_tsv, websearch_to_tsquery('simple', q))
    end as rank
  from public.content_items ci
  where ci.user_id = auth.uid()
    and (q is null or btrim(q) = '' or ci.search_tsv @@ websearch_to_tsquery('simple', q))
    and (
      filters->'source_type' is null
      or ci.source_type in (select jsonb_array_elements_text(filters->'source_type'))
    )
    and (
      filters->'read_status' is null
      or ci.read_status in (select jsonb_array_elements_text(filters->'read_status'))
    )
    and (filters->>'topic' is null or ci.topic = filters->>'topic')
    and (filters->>'is_starred' is null or ci.is_starred = (filters->>'is_starred')::boolean)
    and (
      filters->'tags' is null
      or ci.tags && (select array_agg(t) from jsonb_array_elements_text(filters->'tags') t)
    )
  order by rank desc, ci.created_at desc
  limit 200;
$$;

revoke all on function public.search_items(text, jsonb) from public, anon;
grant execute on function public.search_items(text, jsonb) to authenticated;
