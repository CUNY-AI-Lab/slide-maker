# Slide Maker — Claude Code Instructions

## What This Is

A chat-driven slide builder for the CUNY AI Lab. Users create presentation decks through AI conversation + direct on-canvas editing. Three-panel UI: chat + outline (left), canvas (center), resources (right).

## Architecture

**Monorepo** with pnpm workspaces and Turborepo:

```
apps/api/     — Hono API server (Node, port 3001)
apps/web/     — SvelteKit frontend (Svelte 5, port 5173)
packages/shared/ — Shared TypeScript types
templates/    — Seeded slide template JSON files
```

**Stack:**
- **Frontend:** SvelteKit 2, Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`), TipTap rich text editor, moveable.js for block resize/drag, svelte-dnd-action for reordering, @chenglou/pretext for text measurement
- **Backend:** Hono on Node (@hono/node-server), SQLite via better-sqlite3 + Drizzle ORM, Lucia v3 for auth
- **AI:** Anthropic SDK + OpenAI SDK (for OpenRouter). SSE streaming for chat responses.

## Dev Commands

```bash
pnpm install          # install all deps
pnpm dev              # run both API + web (turborepo)
pnpm db:push          # push Drizzle schema to SQLite
pnpm db:seed          # seed templates + default theme
pnpm seed:admin -- --admin email@gc.cuny.edu --password pass  # create admin user
```

**Env:** `.env` at workspace root, symlinked to `apps/api/.env` and `apps/web/.env`. See `.env.example`.

## Key Conventions

### Svelte 5 Runes
This is a Svelte 5 app. Always use runes, never Svelte 4 patterns:
- `$state()` not `let x`
- `$derived()` not `$: x = ...`
- `$effect()` not `$: { ... }`
- `$props()` not `export let`
- `{@render children()}` not `<slot />`
- `onconsider` not `on:consider` (for svelte-dnd-action)

### Block Types
The system supports exactly these block types. Do NOT invent new ones:
`heading`, `text`, `image`, `code`, `quote`, `steps`, `card-grid`, `embed`

Block data shapes are defined in `packages/shared/src/block-types.ts`.

### Slide Types
`title`, `section-divider`, `body`, `resources`

### Slide Layouts
`single`, `two-column`, `two-column-wide-left`, `two-column-wide-right`

### AI Chat Mutations
The AI emits structured mutations in ` ```mutation ` fenced blocks. The frontend parses these and applies them to the deck store + persists to the API. Mutation types: `addSlide`, `removeSlide`, `updateSlide`, `addBlock`, `removeBlock`, `updateBlock`, `reorderSlides`, `reorderBlocks`, `setTheme`, `updateMetadata`, `applyTemplate`.

System prompt is at `apps/api/src/prompts/system.ts`. It defines the mutation format and block types the AI should use.

### Persistence
All mutations must persist to the API, not just the local Svelte store. The pattern:
1. Call the API endpoint (POST/PATCH/DELETE)
2. Update the local store with the response
3. Canvas re-renders reactively

### Canvas Editing
- **Double-click** a block to enter edit mode (text editing with TipTap)
- **Single-click/drag** for move/resize (via moveable.js)
- BlockWrapper handles the click vs drag conflict via `pointer-events` toggling
- Format toolbar (B/I/Link/List) is fixed above the slide frame, connected to the active TipTap editor

### File Uploads
Files stored at `apps/api/uploads/{deckId}/{fileId}{ext}`. Served at `/api/decks/:deckId/files/:fileId`. Image thumbnails in Files tab. Exported decks rewrite API URLs to local `assets/` paths.

## Database

SQLite at `apps/api/data/slide-maker.db`. Schema at `apps/api/src/db/schema.ts`.

Tables: `users`, `sessions`, `email_verifications`, `decks`, `deck_access`, `slides`, `content_blocks`, `templates`, `themes`, `artifacts`, `uploaded_files`, `chat_messages`, `deck_locks`

Push schema changes with `pnpm db:push` (runs `drizzle-kit push`).

## Auth

- Email/password with CUNY domain gating (`*.cuny.edu` only)
- Registration → email verification → admin approval → login
- Lucia v3 sessions (HTTP-only cookies)
- Admin role required for user approval

## Brand Identity

CUNY AI Lab palette — defined as CSS custom properties in `apps/web/src/app.css`:
- Navy: `#1D3A83`, Blue: `#3B73E6`, Teal: `#2FB8D6`, Gold: `#ffb81c`
- Fonts: Outfit (headings), Inter (body), JetBrains Mono (code)

## Docs

- Vision doc: `slide-builder-prompt-pt1.md`
- v1 spec: `docs/superpowers/specs/2026-03-28-slide-maker-v1-design.md`
- v2 spec: `docs/superpowers/specs/2026-03-28-slide-maker-v2-design.md`
- v1 plan: `docs/superpowers/plans/2026-03-28-slide-maker-v1.md`
- v2 plan: `docs/superpowers/plans/2026-03-28-slide-maker-v2.md`

## Known Issues / Tech Debt

- PreTeXtBook/pretext is a server-side Python toolchain, NOT a browser JS library. Only chenglou/pretext (npm: `@chenglou/pretext`) is integrated for text measurement.
- `svelte-moveable` npm package is Svelte 3/4 only — we use vanilla `moveable` directly via onMount/onDestroy instead.
- Fragment/progressive disclosure is implemented in schema + export but canvas editing UX is minimal (just a badge).
- Export zip doesn't include speaker notes panel yet.
- No real-time collaborative editing — uses pessimistic locking (5-min TTL with heartbeat).
