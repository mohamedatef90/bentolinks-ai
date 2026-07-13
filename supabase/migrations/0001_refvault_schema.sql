-- RefVault Phase 1: core schema
-- Extensions ----------------------------------------------------------------
create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Folders --------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Max nesting depth = 3 (a folder may have at most 2 ancestors)
create or replace function public.check_folder_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  depth int := 0;
  cur uuid := new.parent_id;
begin
  while cur is not null loop
    depth := depth + 1;
    if depth >= 3 then
      raise exception 'MAX_DEPTH_EXCEEDED: folders may be nested at most 3 levels deep';
    end if;
    select parent_id into cur from public.folders where id = cur;
  end loop;
  return new;
end;
$$;

create trigger folders_depth_check
  before insert or update of parent_id on public.folders
  for each row execute function public.check_folder_depth();

-- RSS subscriptions (schema now, poller in Phase 5) ---------------------------
create table public.rss_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_url text not null,
  site_url text,
  title text,
  favicon_url text,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  last_error text,
  error_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, feed_url)
);

-- Content items ----------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  canonical_url text not null,
  source_type text not null default 'other'
    check (source_type in ('article','youtube','reel','tweet','pdf','rss','reddit','podcast','other')),
  status text not null default 'pending'
    check (status in ('pending','parsing','enriching','ready','degraded','failed')),
  title text,
  description text,
  author text,
  site_name text,
  favicon_url text,
  thumbnail_url text,
  language text,
  content_text text,
  summary text,
  key_points jsonb,
  tags text[] not null default '{}',
  topic text,
  word_count int,
  duration_seconds int,
  read_status text not null default 'unread'
    check (read_status in ('unread','reading','read')),
  is_starred boolean not null default false,
  is_pinned boolean not null default false,
  section text, -- deprecated: carried over from BentoLinks for migration fidelity
  published_at timestamptz,
  rss_subscription_id uuid references public.rss_subscriptions(id) on delete set null,
  raw_metadata jsonb,
  tts_summary_path text,
  tts_full_path text,
  embedding extensions.vector(768),
  search_tsv tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', left(coalesce(content_text, ''), 100000)), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, canonical_url)
);

create index content_items_search_idx on public.content_items using gin (search_tsv);
create index content_items_user_created_idx on public.content_items (user_id, created_at desc);
create index content_items_tags_idx on public.content_items using gin (tags);
create index content_items_status_idx on public.content_items (status) where status not in ('ready','failed','degraded');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger content_items_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

-- Item <-> folder (many-to-many) ------------------------------------------------
create table public.item_folders (
  item_id uuid not null references public.content_items(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, folder_id)
);
create index item_folders_folder_idx on public.item_folders (folder_id);

-- Smart collections ---------------------------------------------------------------
create table public.smart_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  position int not null default 0,
  is_system boolean not null default false,
  query jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.seed_system_collections(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.smart_collections (user_id, name, icon, position, is_system, query)
  values
    (uid, 'Inbox',         '📥', 0, true, '{"system":"inbox"}'),
    (uid, 'Reading Queue', '⏳', 1, true, '{"system":"queue","read_status":["unread","reading"]}'),
    (uid, 'Starred',       '⭐', 2, true, '{"system":"starred","is_starred":true}'),
    (uid, 'Resurface',     '🔁', 3, true, '{"system":"resurface"}'),
    (uid, 'RSS',           '📡', 4, true, '{"system":"rss","source_type":["rss"]}')
  on conflict do nothing;
$$;

create or replace function public.handle_new_user_collections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_system_collections(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_seed_collections
  after insert on auth.users
  for each row execute function public.handle_new_user_collections();

-- Seed for existing users
select public.seed_system_collections(id) from auth.users;

-- Jobs queue -------------------------------------------------------------------
create table public.jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  item_id uuid references public.content_items(id) on delete cascade,
  job_type text not null check (job_type in ('parse','enrich','embed','tts','rss_poll')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index jobs_queued_idx on public.jobs (status, run_after) where status = 'queued';

create or replace function public.claim_jobs(n int)
returns setof public.jobs
language sql
security definer
set search_path = public
as $$
  update public.jobs
  set status = 'running', locked_at = now(), attempts = attempts + 1
  where id in (
    select id from public.jobs
    where status = 'queued' and run_after <= now()
    order by id
    limit n
    for update skip locked
  )
  returning *;
$$;

-- claim_jobs is for the service role only
revoke all on function public.claim_jobs(int) from public, anon, authenticated;

-- Reclaim jobs stuck in 'running' for > 10 minutes (crashed worker)
create or replace function public.reclaim_stuck_jobs()
returns int
language sql
security definer
set search_path = public
as $$
  with r as (
    update public.jobs
    set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
        locked_at = null,
        last_error = coalesce(last_error, 'worker timeout')
    where status = 'running' and locked_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::int from r;
$$;
revoke all on function public.reclaim_stuck_jobs() from public, anon, authenticated;

-- RLS ---------------------------------------------------------------------------
alter table public.content_items enable row level security;
alter table public.folders enable row level security;
alter table public.item_folders enable row level security;
alter table public.smart_collections enable row level security;
alter table public.rss_subscriptions enable row level security;
alter table public.jobs enable row level security; -- no policies: service role only

create policy "own content_items" on public.content_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own folders" on public.folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own item_folders" on public.item_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "select own smart_collections" on public.smart_collections
  for select using (user_id = auth.uid());
create policy "insert own smart_collections" on public.smart_collections
  for insert with check (user_id = auth.uid() and is_system = false);
create policy "update own smart_collections" on public.smart_collections
  for update using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);
create policy "delete own smart_collections" on public.smart_collections
  for delete using (user_id = auth.uid() and is_system = false);

create policy "own rss_subscriptions" on public.rss_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: clients watch item status flips (pending -> ready)
alter publication supabase_realtime add table public.content_items;
