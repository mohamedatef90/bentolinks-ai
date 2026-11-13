-- Reconcile database timeout recovery with the item state visible to clients.
create or replace function public.reclaim_stuck_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reclaimed integer;
begin
  update public.jobs
  set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
      locked_at = null,
      last_error = coalesce(last_error, 'worker timeout')
  where status = 'running' and locked_at < now() - interval '10 minutes';
  get diagnostics reclaimed = row_count;

  -- Only the newest terminal job can resolve a processing item. Historical
  -- failures must never demote an item with a newer successful or active job.
  with terminal as (
    select c.id, j.job_type, j.last_error, j.attempts
    from public.content_items c
    cross join lateral (
      select job_type, last_error, attempts, status
      from public.jobs where item_id = c.id order by id desc limit 1
    ) j
    where c.status in ('pending', 'parsing', 'enriching')
      and c.updated_at < now() - interval '10 minutes'
      and j.status = 'failed'
      and not exists (
        select 1 from public.jobs active
        where active.item_id = c.id and active.status in ('queued', 'running')
      )
  )
  update public.content_items c
  set status = case when terminal.job_type = 'parse' then 'failed' else 'degraded' end,
      raw_metadata = jsonb_set(
        coalesce(c.raw_metadata, '{}'::jsonb),
        '{processing}',
        coalesce(c.raw_metadata->'processing', '{}'::jsonb) ||
          jsonb_build_object(terminal.job_type, jsonb_build_object(
            'status', 'failed',
            'error', left(coalesce(terminal.last_error, 'worker timeout'), 500),
            'attempts', terminal.attempts,
            'failed_at', now(),
            'reconciled_by', 'reclaim_stuck_jobs'
          ))
      )
  from terminal where c.id = terminal.id;

  -- Repair inserts that succeeded before their enqueue request failed.
  -- Lock the item so overlapping cron ticks cannot create duplicate repairs.
  insert into public.jobs (user_id, item_id, job_type, payload)
  select c.user_id, c.id,
    case when c.status = 'enriching' then 'enrich' else 'parse' end,
    '{"recovery":"missing_job"}'::jsonb
  from public.content_items c
  where c.status in ('pending', 'parsing', 'enriching')
    and c.updated_at < now() - interval '10 minutes'
    and not exists (select 1 from public.jobs j where j.item_id = c.id)
  for update of c skip locked;

  return reclaimed;
end;
$$;

revoke all on function public.reclaim_stuck_jobs() from public, anon, authenticated;
grant execute on function public.reclaim_stuck_jobs() to service_role;
