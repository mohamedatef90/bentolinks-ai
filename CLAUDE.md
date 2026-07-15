# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server on port 3000
npm run build        # TypeScript compilation + Vite production build
npm run preview      # Preview production build locally
```

**Environment:** Optional `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (fallbacks are hardcoded in `services/supabase.ts`). No AI keys live in the client — the Gemini key is stored in Supabase Vault and used only by Edge Functions.

## Architecture Overview

BentoLinks is evolving into **RefVault**, an AI knowledge vault (see `~/.claude/plans/` RefVault plan / docs). Web MVP phases are complete: Phase 1 (async parse + AI-enrich pipeline), Phase 2 (router/library/reader UI + FTS), Phase 4 (video/tweet/PDF parsers, embeddings + hybrid semantic search), Phase 5 (RSS ingestion, TTS, resurfacing). Phase 3 (Linkat mobile client) is the remaining MVP work.

### Tech Stack
- **Frontend:** React 19, TypeScript 5.7, Vite 6 SPA (stays a SPA — no Next.js)
- **Styling:** Tailwind CSS (CDN), Font Awesome icons
- **Backend:** Supabase — Postgres 17 (project `sjskpjgepbvblojohtlr`, "BentoLinks-Vault"), Auth, Edge Functions, pg_cron + pg_net job queue, pgvector (Phase 4)
- **AI:** Pluggable enrichment provider (`_shared/llm.ts`, Vault `LLM_PROVIDER` = `gemini` | `claude` | `openai`, default `gemini`): Gemini `gemini-2.5-flash`, Claude `claude-haiku-4-5` (tool-use JSON), or OpenAI `gpt-4o-mini` (json_schema) — each needs its key in Vault (`GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`). Embeddings (`gemini-embedding-001`) and TTS stay Gemini-only regardless of provider. All server-side, keys read via `public.get_secret` RPC.
- **Deployment:** Vercel (static) + Supabase Edge Functions
- **Mobile (Phase 3):** the Linkat Flutter app (github.com/mohamedatef90/linkat) becomes the mobile client

### Async Pipeline (replaces any worker/queue infra)
`save-item` Edge Function inserts a `content_items` row (`status='pending'`) + a `jobs` row → pg_cron (`refvault-job-worker`, every minute) invokes `job-worker` via `net.http_post` (Bearer = anon key from Vault + `x-worker-secret` header) → worker claims ≤5 jobs via `claim_jobs()` (`FOR UPDATE SKIP LOCKED`), runs parse (per-source-type parser) → enqueues enrich → enqueues embed → item flips `pending → parsing → enriching → ready`. Clients get live updates via Supabase Realtime on `content_items`.

### RSS ingestion (Phase 5)
pg_cron `refvault-rss-poller` (`7,37 * * * *`) invokes `rss-poller` with the same anon-Bearer + `x-worker-secret` pattern. For each active `rss_subscriptions` row that is due (exponential backoff via `error_count`: 30m→16h; auto-deactivated with `last_error` after 10 consecutive failures), it does a conditional GET (ETag/Last-Modified, 304 = skip), parses RSS/Atom/RDF with fast-xml-parser (`_shared/feed.ts`), inserts new entries as `content_items` (`source_type='rss'`, canonical-URL dedupe via upsert-ignore) and enqueues parse jobs — **capped at 10 new items per feed per poll** to protect the Gemini quota. `rss-poller` also accepts user-JWT calls with `{subscription_id}` to force-poll one of the caller's own feeds (FeedsView "sync now" + first fetch after subscribing). `discover-feed` (user JWT) validates a feed URL or extracts `<link rel="alternate">` candidates from an HTML page (with `/feed`, `/rss.xml`, … fallback probes).

### TTS (Phase 5)
`tts-generate` (user JWT) POST `{item_id, mode: "summary"|"full"}`: if `content_items.tts_<mode>_path` is set it just re-signs a 24h URL (cached, no Gemini call); otherwise it synthesizes with `gemini-2.5-flash-preview-tts` (voice Kore), chunking at sentence boundaries (~2k chars ≈ 500 tokens), concatenates the PCM into one WAV, uploads to the **private `tts-audio` bucket** at `{user_id}/{item_id}/{mode}.wav`, saves the path and returns a signed URL. Summary mode has a hard 30s budget; full mode caps input at 10k chars. Every served URL bumps `tts_last_accessed_at`. Weekly pg_cron `refvault-tts-cleanup` (Sun 03:23) calls `tts-generate` with the worker secret + `{action:"cleanup"}`, which deletes audio untouched >30 days via the Storage API (SQL deletes on `storage.objects` would orphan the real files) and nulls the path columns. Web player: `components/TtsPlayer.tsx` in ReaderView (play/pause/seek/speed, position persisted in localStorage).

### Resurface (Phase 5)
Pure-SQL mechanism: nightly pg_cron `refvault-daily-picks` (02:23) runs `public.refresh_daily_picks()`, which repopulates the `daily_picks` table with ≤5 random items per user where `read_status='read'` and `created_at` older than 14 days. The web app's `api.items.fetchByFilter` detects the Resurface system collection (`{"system":"resurface"}`) and inner-joins `daily_picks`. `daily_picks` RLS is select-own only; writes happen only from the cron.

### Key Directories
- `components/` - React UI components (modals, cards, views)
- `services/`
  - `supabase.ts` - Supabase client only (no data logic)
  - `api.ts` - Data layer: content_items/folders CRUD, save-item invocation, Realtime subscription, `toLink()` adapter
  - `bookmarkService.ts` - HTML bookmark import parsing
- `supabase/migrations/` - SQL migrations (applied via Supabase MCP / CLI)
- `views/` - routed views: `LibraryView`, `ReaderView` (with TtsPlayer), `FeedsView`
- `supabase/functions/` - Edge Functions (Deno)
  - `save-item/` - validate/canonicalize URL, dedupe, insert + enqueue (supports `{urls: []}` batch)
  - `job-worker/` - cron-invoked job processor (parse → enrich → embed; per-source-type parser dispatch)
  - `semantic-search/` - hybrid FTS + pgvector search with RRF merge (user JWT)
  - `rss-poller/` - cron-invoked feed poller (also user-JWT force-poll)
  - `discover-feed/` - feed validation / `<link rel=alternate>` discovery (user JWT)
  - `tts-generate/` - on-demand Gemini TTS + cache + weekly cleanup mode
  - `_shared/` - db/gemini/canonical/queue/cors/feed modules + `parsers/{article,youtube,tweet,pdf,reel,types}.ts`

### Database Schema (RefVault)
- `content_items` — superset of old `links`: canonical_url (unique per user = dedupe), source_type, status, `saved_via` (web/mobile/extension/import/rss — client origin, set by save-item/rss-poller; powers the "From your phone" home section + system collection, migration 0009), `item_kind` (generated column, migration 0011 — `'content'` for rich source types (youtube/reel/tweet/reddit/pdf/podcast/rss) or anything with an extracted body/summary; else `'bookmark'`; drives the Vault Hub vs Library split), content_text, summary, key_points, tags[], topic, read_status, is_starred/pinned, embedding vector(768), generated `search_tsv`
- `folders` (tree, max depth 3), `item_folders` (many-to-many), `smart_collections` (query jsonb; system rows seeded per user), `rss_subscriptions` (etag/last_modified conditional GET state, error_count backoff), `daily_picks` (nightly Resurface set), `jobs` (queue; service-role only, no RLS policies by design)
- Legacy `links`/`categories` tables still exist read-only; drop at Phase 2 cutover. Backup in `backups/`.

### Key Patterns
- All RLS: `user_id = auth.uid()`; `jobs` and Vault access are service-role only
- Secrets in Supabase Vault, read by Edge Functions via locked-down `public.get_secret(name)` RPC
- Gemini structured output (`responseMimeType: application/json` + responseSchema) with 429/5xx backoff retry
- Edge Function deploys were done via Supabase MCP `deploy_edge_function` with the full file bundle including `_shared/*` (files under `supabase/functions/` are the source of truth — redeploy after editing)
- Cron-invoked functions (`job-worker`, `rss-poller`, `tts-generate` cleanup) are gated by the `x-worker-secret` header checked against Vault; the cron SQL reads ANON_KEY/WORKER_SECRET from Vault at fire time (pattern in `0004_cron_worker_tick.sql`)
- Source-type parsers: youtube (oEmbed + caption endpoints, Gemini URL-ingestion fallback; stores `video_url`/`embed_url` in raw_metadata), tweet (fxtwitter), reddit (app-only OAuth via `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` in Vault → oauth.reddit.com; falls back to public `.json` which 403s from cloud IPs), pdf (unpdf + Gemini Files fallback), reel (opt-in paid scrapers via APIFY_TOKEN/SCRAPER_API_KEY in Vault; captures `video_url` + transcribes spoken audio via Gemini Files (`transcribeVideoBytes`, 20MB cap) merged with the caption; else `status='degraded'`)

### Theming & Home UX
Three themes via CSS variables: `default` (dark), `professional` (light), `funny` (playful). Theme preference persisted in localStorage.

The `default` theme uses the **magic_black** design language: navy canvas (`--ink #0A1320`), glass panels (`--panel` + backdrop-blur), green→lime gradient accent (`--grad`, `--lime #A8CF38` drives the legacy `neon-accent` classes). Motion helpers in `components/magic.tsx` (Reveal, CountUp, card spotlight, CursorGlow) — all `prefers-reduced-motion`-guarded; tokens/CSS live in `index.html`.

**Bookmark vs content split (`item_kind`):** the two kinds of saved link route to two surfaces — **Vault Hub** (home) is for `item_kind='bookmark'` (plain website links, e.g. the ~979 migrated BentoLinks links), and the **Library** is for `item_kind='content'` (articles, videos, social posts, PDFs, RSS). The client filters on `link.kind` (mapped from `item_kind` in `toLink`); `fetchByFilter` accepts a `kind` filter. Library has a **Reading / Bookmarks / All** tab in its own `?kind=` URL param (absent = content, the default; `kind=bookmark`; `kind=all`). Card treatment (`ItemCard` + home `LinkCard`) diverges by kind: **content** cards carry a lime book badge (top-right, cross-fades to hover controls), a Read / Continue reading / Read again primary button, and open the in-app reader (`/item/:id`) on card click; **bookmark** cards carry a neutral bookmark badge, a "Visit site" button, and open the source URL directly (`window.open`, never the reader) — and show "bookmark" instead of the raw `source_type`.

Home ("Vault Hub") is a **daily briefing**, not an archive: capped sections — Continue reading (content, read_status='reading', ≤6), Today's Picks (daily_picks, ≤5), Fresh in your Library (latest content, ≤6, → /library), From your phone (saved_via='mobile'), Recently bookmarked (≤12, "View all" → /library?kind=bookmark) — each linking into the Library; the hero stats read Bookmarks / Library / Unread; the hero's right panel shows latest feed items (pipeline items take it over while processing); the nav search switches home to a results grid. The home grid is bookmarks only (`kind='bookmark'`); content sections bridge into the Library. Skeleton shimmer while loading. Card titles open the reader (/item/:id); "Visit site" opens the source.

Responsive/a11y: mobile (<lg) gets a fixed bottom nav (Vault/Library/Feeds/Settings) and the Library sidebar collapses to a chip scroller; hover-revealed card actions become visible on touch devices via the `.hover-reveal` class (`@media (hover:none)` in index.html); Library filter state lives in URL query params (`views/LibraryView.tsx` filterFromParams/paramsFromFilter). Library has three view modes persisted in localStorage (`library-view`): grid, list, and **reader** — a Readwise-style split pane (`components/ReaderSplit.tsx`, j/k navigation, metadata rail, AI summary block). System collections show explanatory empty states.
