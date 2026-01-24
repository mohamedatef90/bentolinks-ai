# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server on port 3000
npm run build        # TypeScript compilation + Vite production build
npm run preview      # Preview production build locally
```

**Environment:** Set `GEMINI_API_KEY` in `.env.local` for Gemini AI features.

## Architecture Overview

BentoLinks AI is a React 19 + TypeScript link management app with AI-powered categorization.

### Tech Stack
- **Frontend:** React 19, TypeScript 5.7, Vite 6
- **Styling:** Tailwind CSS (CDN), Font Awesome icons
- **Database:** Supabase (PostgreSQL) with optional auth
- **AI:** Google Gemini (`gemini-3-flash-preview`) for link analysis and tech news
- **Deployment:** Vercel

### Key Directories
- `components/` - React UI components (modals, cards, views)
- `services/` - External service integrations
  - `supabase.ts` - Database operations, auth, localStorage sync
  - `geminiService.ts` - AI link analysis with retry logic
  - `bookmarkService.ts` - HTML bookmark import parsing

### Data Flow
1. **Hybrid storage model:** Supabase when authenticated, localStorage fallback for offline/anonymous use
2. **Optimistic updates:** UI updates immediately, syncs to backend in background
3. **AI link analysis:** URL → Gemini API → structured JSON (title, description, category, icon)

### Database Schema
- `links` table: id, url, title, description, category_id, section, is_pinned, user_id
- `categories` table: id, name, color (Tailwind class), icon (FA class), user_id

### Theming
Three themes via CSS variables: `default` (dark), `professional` (light), `funny` (playful). Theme preference persisted in localStorage.

### Key Patterns
- Service layer (`db.links.upsert()`, `db.categories.fetchAll()`) wraps Supabase SDK
- Gemini responses use `responseMimeType: "application/json"` with structured schemas
- Rate limit handling with exponential backoff (429 retry logic)
- Drag-and-drop for category/link reordering via React state
