// Cron-invoked worker: claims queued jobs and runs the parse -> enrich pipeline.
// Invoked every minute by pg_cron via pg_net with the anon key as Bearer token
// plus an x-worker-secret header checked against Vault.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { serviceClient, getSecret } from '../_shared/db.ts';
import { Job, completeJob, failJob, enqueue } from '../_shared/queue.ts';
import { parseArticle } from '../_shared/parsers/article.ts';
import { enrichContent } from '../_shared/gemini.ts';

const BATCH_SIZE = 5;
const TIME_BUDGET_MS = 120_000;
const MIN_ENRICH_CHARS = 200;

async function handleParse(db: SupabaseClient, job: Job) {
  const { data: item, error } = await db
    .from('content_items')
    .select('id, user_id, url, source_type, title, status')
    .eq('id', job.item_id!)
    .single();
  if (error || !item) throw new Error(`item ${job.item_id} not found`);

  await db.from('content_items').update({ status: 'parsing' }).eq('id', item.id);

  // Phase 1: full parsing for articles; other source types get OG metadata only
  // and are marked degraded until their dedicated parsers land (Phase 4).
  const parsed = await parseArticle(item.url);

  const hasContent = !!parsed.content_text && parsed.content_text.length >= MIN_ENRICH_CHARS;

  await db.from('content_items').update({
    title: parsed.title ?? item.title,
    description: parsed.description,
    author: parsed.author,
    site_name: parsed.site_name,
    thumbnail_url: parsed.thumbnail_url,
    favicon_url: parsed.favicon_url,
    published_at: parsed.published_at,
    content_text: parsed.content_text,
    word_count: parsed.word_count,
    status: hasContent ? 'enriching' : 'degraded',
  }).eq('id', item.id);

  if (hasContent) {
    await enqueue(db, { user_id: item.user_id, item_id: item.id, job_type: 'enrich' });
  }
}

async function handleEnrich(db: SupabaseClient, job: Job, geminiKey: string) {
  const { data: item, error } = await db
    .from('content_items')
    .select('id, url, title, source_type, content_text, tags')
    .eq('id', job.item_id!)
    .single();
  if (error || !item) throw new Error(`item ${job.item_id} not found`);
  if (!item.content_text || item.content_text.length < MIN_ENRICH_CHARS) {
    await db.from('content_items').update({ status: 'degraded' }).eq('id', item.id);
    return;
  }

  const result = await enrichContent(geminiKey, {
    title: item.title,
    url: item.url,
    sourceType: item.source_type,
    content: item.content_text,
  });

  const userTags: string[] = item.tags ?? [];
  const mergedTags = [...new Set([...userTags, ...result.tags])].slice(0, 10);

  await db.from('content_items').update({
    title: item.title ?? result.suggested_title,
    summary: result.summary,
    key_points: result.key_points,
    topic: result.topic_category,
    tags: mergedTags,
    language: result.language,
    status: 'ready',
  }).eq('id', item.id);
}

async function markItemForFailedJob(db: SupabaseClient, job: Job) {
  if (!job.item_id) return;
  const status = job.job_type === 'parse' ? 'failed' : 'degraded';
  await db.from('content_items').update({ status }).eq('id', job.item_id);
}

async function processJobs(): Promise<{ processed: number; failed: number }> {
  const db = serviceClient();
  const started = Date.now();
  let processed = 0;
  let failed = 0;

  await db.rpc('reclaim_stuck_jobs');

  const geminiKey = await getSecret(db, 'GEMINI_API_KEY');

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: jobs, error } = await db.rpc('claim_jobs', { n: BATCH_SIZE });
    if (error) {
      console.error('claim_jobs failed:', error.message);
      break;
    }
    if (!jobs || jobs.length === 0) break;

    for (const job of jobs as Job[]) {
      try {
        switch (job.job_type) {
          case 'parse':
            await handleParse(db, job);
            break;
          case 'enrich':
            if (!geminiKey) throw new Error('GEMINI_API_KEY missing from Vault');
            await handleEnrich(db, job, geminiKey);
            break;
          default:
            throw new Error(`No handler for job_type ${job.job_type} yet`);
        }
        await completeJob(db, job.id);
        processed++;
      } catch (e) {
        const terminal = await failJob(db, job, (e as Error).message);
        if (terminal) await markItemForFailedJob(db, job);
        failed++;
        console.error(`job ${job.id} (${job.job_type}) failed:`, (e as Error).message);
      }
    }
  }

  return { processed, failed };
}

Deno.serve(async (req: Request) => {
  const db = serviceClient();
  const expected = await getSecret(db, 'WORKER_SECRET');
  if (!expected || req.headers.get('x-worker-secret') !== expected) {
    return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
  }

  // Respond immediately; keep processing in the background so the pg_net
  // caller's short timeout doesn't kill the run.
  EdgeRuntime.waitUntil(
    processJobs().then((r) => console.log(`worker done: ${JSON.stringify(r)}`)),
  );

  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
});
