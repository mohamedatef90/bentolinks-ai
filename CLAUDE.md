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

BentoLinks is evolving into **RefVault**, an AI knowledge vault (see `~/.claude/plans/` RefVault plan / docs). Phase 1 is complete: async parse + AI-enrich pipeline on Supabase.

### Tech Stack
- **Frontend:** React 19, TypeScript 5.7, Vite 6 SPA (stays a SPA — no Next.js)
- **Styling:** Tailwind CSS (CDN), Font Awesome icons
- **Backend:** Supabase — Postgres 17 (project `sjskpjgepbvblojohtlr`, "BentoLinks-Vault"), Auth, Edge Functions, pg_cron + pg_net job queue, pgvector (Phase 4)
- **AI:** Google Gemini `gemini-2.5-flash` server-side only (key in Supabase Vault, read via `public.get_secret` RPC)
- **Deployment:** Vercel (static) + Supabase Edge Functions
- **Mobile (Phase 3):** the Linkat Flutter app (github.com/mohamedatef90/linkat) becomes the mobile client

### Async Pipeline (replaces any worker/queue infra)
`save-item` Edge Function inserts a `content_items` row (`status='pending'`) + a `jobs` row → pg_cron (`refvault-job-worker`, every minute) invokes `job-worker` via `net.http_post` (Bearer = anon key from Vault + `x-worker-secret` header) → worker claims ≤5 jobs via `claim_jobs()` (`FOR UPDATE SKIP LOCKED`), runs parse → enqueues enrich → item flips `pending → parsing → enriching → ready`. Clients get live updates via Supabase Realtime on `content_items`.

### Key Directories
- `components/` - React UI components (modals, cards, views)
- `services/`
  - `supabase.ts` - Supabase client only (no data logic)
  - `api.ts` - Data layer: content_items/folders CRUD, save-item invocation, Realtime subscription, `toLink()` adapter
  - `bookmarkService.ts` - HTML bookmark import parsing
- `supabase/migrations/` - SQL migrations (applied via Supabase MCP / CLI)
- `supabase/functions/` - Edge Functions (Deno)
  - `save-item/` - validate/canonicalize URL, dedupe, insert + enqueue (supports `{urls: []}` batch)
  - `job-worker/` - cron-invoked job processor (parse via Readability/linkedom, enrich via Gemini)
  - `_shared/` - db/gemini/canonical/queue/cors modules + `parsers/article.ts`

### Database Schema (RefVault)
- `content_items` — superset of old `links`: canonical_url (unique per user = dedupe), source_type, status, content_text, summary, key_points, tags[], topic, read_status, is_starred/pinned, embedding vector(768), generated `search_tsv`
- `folders` (tree, max depth 3), `item_folders` (many-to-many), `smart_collections` (query jsonb; system rows seeded per user), `rss_subscriptions`, `jobs` (queue; service-role only, no RLS policies by design)
- Legacy `links`/`categories` tables still exist read-only; drop at Phase 2 cutover. Backup in `backups/`.

### Key Patterns
- All RLS: `user_id = auth.uid()`; `jobs` and Vault access are service-role only
- Secrets in Supabase Vault, read by Edge Functions via locked-down `public.get_secret(name)` RPC
- Gemini structured output (`responseMimeType: application/json` + responseSchema) with 429/5xx backoff retry
- Edge Function deploys were done via Supabase MCP `deploy_edge_function` (files under `supabase/functions/` are the source of truth — redeploy after editing)
- Non-article source types (youtube/reel/tweet/pdf) currently degrade to OG metadata (`status='degraded'`) until Phase 4 parsers land

### Theming
Three themes via CSS variables: `default` (dark), `professional` (light), `funny` (playful). Theme preference persisted in localStorage.
