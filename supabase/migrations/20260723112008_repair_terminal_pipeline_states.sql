-- Older worker versions could exhaust a job while leaving the card in a
-- perpetual pending/parsing/enriching state. Preserve the item and extracted
-- metadata, but surface a truthful retryable terminal status in every client.
update public.content_items as item
set status = case
  when exists (
    select 1 from public.jobs job
    where job.item_id = item.id
      and job.status = 'failed'
      and job.job_type = 'enrich'
  ) then 'degraded'
  else 'failed'
end
where item.status in ('pending', 'parsing', 'enriching')
  and exists (
    select 1 from public.jobs job
    where job.item_id = item.id
      and job.status = 'failed'
      and job.attempts >= job.max_attempts
  );
