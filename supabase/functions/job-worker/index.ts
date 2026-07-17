// Cron-invoked worker: claims queued jobs and runs the parse -> enrich pipeline.
// Invoked every minute by pg_cron via pg_net with the anon key as Bearer token
// plus an x-worker-secret header checked against Vault.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { serviceClient, getSecret } from '../_shared/db.ts';
import { Job, completeJob, failJob, enqueue } from '../_shared/queue.ts';
import { parseArticle } from '../_shared/parsers/article.ts';
import { parseYouTube } from '../_shared/parsers/youtube.ts';
import { parseTweet } from '../_shared/parsers/tweet.ts';
import { parsePdf } from '../_shared/parsers/pdf.ts';
import { parseReel } from '../_shared/parsers/reel.ts';
import { parseReddit } from '../_shared/parsers/reddit.ts';
import { parseFacebook, isFacebookContentUrl } from '../_shared/parsers/facebook.ts';
import { ParsedContent } from '../_shared/parsers/types.ts';
import { embedText } from '../_shared/gemini.ts';
import { enrich, LlmProvider, ProviderConfig } from '../_shared/llm.ts';

const BATCH_SIZE = 5;
const TIME_BUDGET_MS = 120_000;
const MIN_ENRICH_CHARS = 200;

async function parseBySourceType(
  db: SupabaseClient,
  item: { url: string; source_type: string },
  geminiKey: string | null,
): Promise<ParsedContent> {
  // Facebook has no source_type of its own (URL 400s the generic parser), so it
  // dispatches by URL — but only for real post/reel/video links, not FB tool pages.
  if (isFacebookContentUrl(item.url)) {
    return await parseFacebook(item.url, { apifyToken: await getSecret(db, 'APIFY_TOKEN') });
  }
  switch (item.source_type) {
    case 'youtube':
      return await parseYouTube(item.url, geminiKey);
    case 'tweet':
      return await parseTweet(item.url);
    case 'reddit':
      return await parseReddit(item.url, {
        clientId: await getSecret(db, 'REDDIT_CLIENT_ID'),
        clientSecret: await getSecret(db, 'REDDIT_CLIENT_SECRET'),
      });
    case 'pdf':
      return await parsePdf(item.url, geminiKey);
    case 'reel':
      return await parseReel(item.url, {
        apifyToken: await getSecret(db, 'APIFY_TOKEN'),
        scraperApiKey: await getSecret(db, 'SCRAPER_API_KEY'),
        geminiKey,
      });
    default:
      return await parseArticle(item.url);
  }
}

async function handleParse(db: SupabaseClient, job: Job, geminiKey: string | null) {
  const { data: item, error } = await db
    .from('content_items')
    .select('id, user_id, url, source_type, title, status')
    .eq('id', job.item_id!)
    .single();
  if (error || !item) throw new Error(`item ${job.item_id} not found`);

  await db.from('content_items').update({ status: 'parsing' }).eq('id', item.id);

  let parsed: ParsedContent;
  try {
    parsed = await parseBySourceType(db, item, geminiKey);
  } catch (e) {
    // Specialized endpoints are brittle — degrade to plain OG metadata.
    console.warn(`${item.source_type} parser failed for ${item.url}, falling back to OG:`, (e as Error).message);
    try {
      parsed = await parseArticle(item.url);
    } catch (e2) {
      // Page unreachable (bot-blocked, login-walled, dead): keep a metadata
      // stub so the item still gets an AI title + summary from the URL alone
      // instead of dying as 'failed' with an empty card.
      const host = (() => { try { return new URL(item.url).hostname; } catch { return null; } })();
      console.warn(`OG fallback also failed for ${item.url}:`, (e2 as Error).message);
      parsed = {
        title: null,
        description: null,
        author: null,
        site_name: host?.replace(/^www\./, '') ?? null,
        thumbnail_url: null,
        favicon_url: host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null,
        published_at: null,
        content_text: null,
        word_count: null,
        raw_metadata: { parse_error: (e2 as Error).message },
      };
    }
  }

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
    duration_seconds: parsed.duration_seconds ?? null,
    raw_metadata: parsed.raw_metadata ?? null,
    status: 'enriching',
  }).eq('id', item.id);

  // Every item gets enriched — metadata-only bookmarks and un-scrapable social
  // links included (the LLM writes an AI title + summary from URL/title/snippet).
  await enqueue(db, { user_id: item.user_id, item_id: item.id, job_type: 'enrich' });
}

async function handleEnrich(db: SupabaseClient, job: Job, llm: ProviderConfig) {
  const { data: item, error } = await db
    .from('content_items')
    .select('id, user_id, url, title, description, source_type, content_text, tags, raw_metadata')
    .eq('id', job.item_id!)
    .single();
  if (error || !item) throw new Error(`item ${job.item_id} not found`);

  // Thin/metadata-only items enrich from whatever the parser got (description,
  // scraps of text); llm.ts detects the thin case and describes the destination.
  const content = item.content_text && item.content_text.length >= MIN_ENRICH_CHARS
    ? item.content_text
    : [item.description, item.content_text].filter(Boolean).join('\n\n');

  const result = await enrich(llm, {
    title: item.title,
    url: item.url,
    sourceType: item.source_type,
    content,
  });

  const userTags: string[] = item.tags ?? [];
  const mergedTags = [...new Set([...userTags, ...result.tags])].slice(0, 10);

  // Keep a real parsed title; replace missing or URL-looking ones with the AI's.
  const hasRealTitle = !!item.title?.trim() && !/^https?:\/\//i.test(item.title.trim());

  await db.from('content_items').update({
    title: hasRealTitle ? item.title : (result.suggested_title || item.title),
    summary: result.summary,
    key_points: result.key_points,
    topic: result.topic_category,
    tags: mergedTags,
    language: result.language,
    // Which provider actually produced this (e.g. 'nvidia:z-ai/glm-5.2' or
    // 'gemini:fallback') — verifiable via SQL instead of ephemeral logs.
    raw_metadata: { ...((item.raw_metadata as Record<string, unknown>) ?? {}), enriched_by: result.enriched_by },
    status: 'ready',
  }).eq('id', item.id);

  await enqueue(db, { user_id: item.user_id, item_id: item.id, job_type: 'embed' });
}

async function handleEmbed(db: SupabaseClient, job: Job, geminiKey: string) {
  const { data: item, error } = await db
    .from('content_items')
    .select('id, title, summary, content_text')
    .eq('id', job.item_id!)
    .single();
  if (error || !item) throw new Error(`item ${job.item_id} not found`);

  const text = [item.title, item.summary, item.content_text?.slice(0, 2000)]
    .filter(Boolean)
    .join('\n');
  if (!text.trim()) return; // nothing to embed — leave the column null

  const vector = await embedText(geminiKey, text, 'RETRIEVAL_DOCUMENT');
  const { error: upErr } = await db
    .from('content_items')
    .update({ embedding: JSON.stringify(vector) })
    .eq('id', item.id);
  if (upErr) throw new Error(`embedding write failed: ${upErr.message}`);
}

async function markItemForFailedJob(db: SupabaseClient, job: Job) {
  if (!job.item_id) return;
  // A failed embed must not demote an already-ready item — search degrades to FTS.
  if (job.job_type === 'embed') return;
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
  // Enrichment provider is pluggable (Vault LLM_PROVIDER); embeddings/TTS stay Gemini.
  // Production: nvidia (z-ai/glm-5.2), with automatic Gemini fallback inside enrich().
  const llm: ProviderConfig = {
    provider: ((await getSecret(db, 'LLM_PROVIDER')) as LlmProvider) || 'gemini',
    geminiKey,
    anthropicKey: await getSecret(db, 'ANTHROPIC_API_KEY'),
    openaiKey: await getSecret(db, 'OPENAI_API_KEY'),
    nvidiaKey: await getSecret(db, 'NVIDIA_API_KEY'),
    model: await getSecret(db, 'LLM_MODEL'),
    fastModel: await getSecret(db, 'LLM_MODEL_FAST'),
  };

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
            await handleParse(db, job, geminiKey);
            break;
          case 'enrich':
            await handleEnrich(db, job, llm);
            break;
          case 'embed':
            if (!geminiKey) throw new Error('GEMINI_API_KEY missing from Vault');
            await handleEmbed(db, job, geminiKey);
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
