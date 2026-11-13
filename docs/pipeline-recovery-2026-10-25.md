# Pipeline recovery — 2026-10-25

Applied `reconcile_pipeline_timeouts` to Supabase project `sjskpjgepbvblojohtlr`.

## Cause and change

The database `reclaim_stuck_jobs()` RPC exhausted timed-out jobs without resolving
the corresponding item's processing status. The Edge Function's exception handler
cannot handle an isolate that has already been terminated. Three pending RSS
items also had no job rows.

The RPC now reconciles the latest failed job into a retryable failed/degraded
item state, records processing diagnostics, and restores missing jobs for stale
processing items. It preserves active retries, newer successful jobs, and ready
items with failed embedding jobs. Execute remains restricted to service_role.

Requeued the 41 affected items with five-second spacing and a
`pipeline_repair_20261025` payload marker. Their metadata contains the recovery
batch and enqueue time. Existing failed job history remains intact.

## Verification

- `tests/pipeline-recovery.sql`: eight live database assertions passed; fixtures
  and their changes were rolled back.
- `npm run build`: passed; existing 550 KB bundle warning remains.
- `node --test tests/*.test.mjs`: all 13 tests passed.
- Security advisors: no new findings after the RPC change.
- First live recovery item reached ready; remaining recovery was still running
  when this note was written. Successful enrichment is not guaranteed for every
  source or provider request.

Inspect recovery progress without exposing saved content:

```sql
select status, count(*)
from public.content_items
where raw_metadata->'pipeline_recovery'->>'batch' = 'pipeline_repair_20261025'
group by status;

select status, count(*)
from public.jobs
where payload->>'recovery' = 'pipeline_repair_20261025'
group by status;
```

This repair does not backfill the entire historical summary/embedding gap or
change Auth configuration, unrelated indexes, or frontend bundling.
