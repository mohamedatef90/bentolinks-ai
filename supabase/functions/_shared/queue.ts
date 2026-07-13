import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type JobType = 'parse' | 'enrich' | 'embed' | 'tts' | 'rss_poll';

export interface Job {
  id: number;
  user_id: string;
  item_id: string | null;
  job_type: JobType;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
}

export async function enqueue(
  db: SupabaseClient,
  job: { user_id: string; item_id?: string; job_type: JobType; payload?: Record<string, unknown> },
) {
  const { error } = await db.from('jobs').insert({
    user_id: job.user_id,
    item_id: job.item_id ?? null,
    job_type: job.job_type,
    payload: job.payload ?? {},
  });
  if (error) throw new Error(`enqueue ${job.job_type} failed: ${error.message}`);
}

export async function completeJob(db: SupabaseClient, id: number) {
  await db.from('jobs').update({ status: 'done', locked_at: null }).eq('id', id);
}

/** Retry with backoff until max_attempts, then mark failed. */
export async function failJob(db: SupabaseClient, job: Job, err: string) {
  const terminal = job.attempts >= job.max_attempts;
  await db.from('jobs').update({
    status: terminal ? 'failed' : 'queued',
    locked_at: null,
    last_error: err.slice(0, 2000),
    run_after: terminal
      ? undefined
      : new Date(Date.now() + job.attempts * 2 * 60_000).toISOString(),
  }).eq('id', job.id);
  return terminal;
}
