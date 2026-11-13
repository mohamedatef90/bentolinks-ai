begin;
do $test$
declare
  owner_id uuid;
  enrich_id uuid := gen_random_uuid();
  parse_id uuid := gen_random_uuid();
  retry_id uuid := gen_random_uuid();
  orphan_id uuid := gen_random_uuid();
  ready_id uuid := gen_random_uuid();
  newer_id uuid := gen_random_uuid();
begin
  select user_id into owner_id from public.content_items limit 1;
  insert into public.content_items(id,user_id,url,canonical_url,status,updated_at)
  select id,owner_id,'https://example.com/'||id,'https://example.com/'||id,status,now()-interval '1 hour'
  from (values(enrich_id,'enriching'),(parse_id,'parsing'),(retry_id,'enriching'),
    (orphan_id,'pending'),(ready_id,'ready'),(newer_id,'enriching')) v(id,status);
  insert into public.jobs(user_id,item_id,job_type,status,attempts,max_attempts,locked_at)
  values
    (owner_id,enrich_id,'enrich','running',3,3,now()-interval '11 minutes'),
    (owner_id,parse_id,'parse','running',3,3,now()-interval '11 minutes'),
    (owner_id,retry_id,'enrich','running',1,3,now()-interval '11 minutes'),
    (owner_id,ready_id,'embed','running',3,3,now()-interval '11 minutes'),
    (owner_id,newer_id,'enrich','failed',3,3,null);
  insert into public.jobs(user_id,item_id,job_type,status)
    values(owner_id,newer_id,'enrich','done');
  perform public.reclaim_stuck_jobs();
  if (select status from public.content_items where id=enrich_id) <> 'degraded' then
    raise exception 'Exhausted enrichment remained processing'; end if;
  if (select status from public.content_items where id=parse_id) <> 'failed' then
    raise exception 'Exhausted parse remained processing'; end if;
  if (select status from public.jobs where item_id=retry_id) <> 'queued' then
    raise exception 'Retryable timeout was not requeued'; end if;
  if (select status from public.content_items where id=retry_id) <> 'enriching' then
    raise exception 'Active retry was incorrectly demoted'; end if;
  if (select status from public.content_items where id=ready_id) <> 'ready' then
    raise exception 'Embedding timeout demoted ready item'; end if;
  if (select status from public.content_items where id=newer_id) <> 'enriching' then
    raise exception 'Historical failure overrode newer job'; end if;
  perform public.reclaim_stuck_jobs();
  if (select count(*) from public.jobs where item_id=orphan_id) <> 1 then
    raise exception 'Missing-job recovery is not idempotent'; end if;
  if has_function_privilege('anon','public.reclaim_stuck_jobs()','execute')
     or has_function_privilege('authenticated','public.reclaim_stuck_jobs()','execute')
     or not has_function_privilege('service_role','public.reclaim_stuck_jobs()','execute') then
    raise exception 'Worker RPC grants are incorrect'; end if;
end;
$test$;
select '8 pipeline recovery checks passed; fixtures rolled back' result;
rollback;
