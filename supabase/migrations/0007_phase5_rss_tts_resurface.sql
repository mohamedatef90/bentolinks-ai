-- RefVault Phase 5: RSS polling cron, TTS storage bucket + access tracking,
-- Resurface daily picks, and weekly TTS storage cleanup.

-- 1. Resurface: daily_picks holds each user's nightly random set of old read
--    items. Repopulated by the refvault-daily-picks cron below; the web app
--    joins content_items -> daily_picks when the Resurface system collection
--    ({"system":"resurface"}) is opened.
create table if not exists public.daily_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.content_items(id) on delete cascade,
  picked_on date not null default current_date,
  primary key (user_id, item_id)
);

alter table public.daily_picks enable row level security;

create policy "read own daily_picks" on public.daily_picks
  for select using (user_id = auth.uid());
-- Writes happen only from the nightly cron (superuser) — no user write policies.

create or replace function public.refresh_daily_picks()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.daily_picks;
  insert into public.daily_picks (user_id, item_id)
  select user_id, id
  from (
    select user_id, id,
           row_number() over (partition by user_id order by random()) as rn
    from public.content_items
    where read_status = 'read'
      and created_at < now() - interval '14 days'
  ) candidates
  where rn <= 5;
$$;

revoke all on function public.refresh_daily_picks() from public, anon, authenticated;

select cron.schedule(
  'refvault-daily-picks',
  '23 2 * * *',
  $$ select public.refresh_daily_picks(); $$
);

-- 2. TTS audio storage: private bucket, per-user folder ({user_id}/{item_id}/{mode}.wav).
--    Uploads and signed URLs are issued by the tts-generate Edge Function
--    (service role); the read policy lets authenticated users fetch only their
--    own folder if a client ever reads directly.
insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', false)
on conflict (id) do nothing;

create policy "read own tts audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- Tracks the last time a signed URL was served for an item's TTS audio;
-- the weekly cleanup deletes audio untouched for >30 days.
alter table public.content_items
  add column if not exists tts_last_accessed_at timestamptz;

-- 3. RSS poller tick: every 30 minutes (offset to avoid the :00/:30 stampede).
--    Same Vault-read pattern as the job-worker tick in 0004.
select cron.schedule(
  'refvault-rss-poller',
  '7,37 * * * *',
  $$
  select net.http_post(
    url := 'https://sjskpjgepbvblojohtlr.supabase.co/functions/v1/rss-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ANON_KEY'),
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'WORKER_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- 4. Weekly TTS storage cleanup (Sunday 03:23): tts-generate's worker-secret
--    mode deletes audio objects untouched >30 days via the Storage API (a plain
--    SQL delete from storage.objects would orphan the underlying files).
select cron.schedule(
  'refvault-tts-cleanup',
  '23 3 * * 0',
  $$
  select net.http_post(
    url := 'https://sjskpjgepbvblojohtlr.supabase.co/functions/v1/tts-generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ANON_KEY'),
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'WORKER_SECRET')
    ),
    body := '{"action":"cleanup"}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
