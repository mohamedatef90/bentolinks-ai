-- Every-minute tick: invoke the job-worker Edge Function via pg_net.
-- Secrets (ANON_KEY, WORKER_SECRET) are read from Vault at fire time,
-- so rotating them requires no cron changes.

select cron.schedule(
  'refvault-job-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://sjskpjgepbvblojohtlr.supabase.co/functions/v1/job-worker',
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
