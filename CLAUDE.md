# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Check `TODO.md` for the current task list when planning work, but default to the operator's instructions, especially if they involve birds.

## What This Is

A chat-driven slide builder for the CUNY AI Lab. Users create presentation decks through AI conversation + direct on-canvas editing. Three-panel UI: chat + outline (left), canvas (center), resources (right). Produces HTML slide decks matching the CUNY AI Lab's actual deck framework (section-based navigation, step reveals, carousel sync).

## Architecture

**Monorepo** with pnpm workspaces and Turborepo:

```
apps/api/     — Hono API server (Node, port 3001 dev / 3004 staging)
apps/web/     — SvelteKit frontend (Svelte 5, port 5173 dev / 4173 staging)
packages/shared/ — Shared TypeScript types and constants
templates/    — Seeded slide template JSON files (zone-based)
```

**Stack:**
- **Frontend:** SvelteKit 2, Svelte 5 (runes), TipTap rich text editor
- **Backend:** Hono on Node (@hono/node-server), SQLite via better-sqlite3 + Drizzle ORM, Lucia v3 for auth
- **AI:** Three providers — Anthropic SDK (Claude Sonnet 4, Haiku 4.5; optional admin-only Sonnet 4.6 via `ANTHROPIC_SONNET_46_MODEL_ID` env var), OpenAI SDK for OpenRouter (Kimi K2.5, GLM 5, Gemini 3.1 Flash, Qwen 3.5 Flash), and AWS Bedrock (Haiku 4.5, Sonnet 4.6). Model selection via dropdown. SSE streaming for chat responses with live mutation application. Provider config at `apps/api/src/providers/`.

## Dev Commands

```bash
pnpm install          # install all deps
pnpm dev              # run both API + web via turborepo
pnpm dev:bedrock      # run with AWS Bedrock provider
pnpm dev:anthropic    # run with Anthropic SDK provider
pnpm dev:openrouter   # run with OpenRouter provider
pnpm build            # production build (both apps)
pnpm db:push          # push Drizzle schema changes to SQLite
pnpm db:seed          # seed templates, default theme, and admin users
pnpm seed:admin       # seed admin users only
pnpm audit:a11y       # run a11y theme contrast audit (WCAG AA/AAA)
npx vitest run        # run all unit tests
npx vitest run tests/framework-css.test.ts  # run a single test file
npx vitest --watch    # watch mode
```

**Env:** `.env` at workspace root, must be symlinked to `apps/api/.env` (`ln -s ../../.env apps/api/.env`). The API loads env via `dotenv/config` from its own CWD — without the symlink, no API keys are found and chat won't work. See `.env.example` for all vars. At minimum set one provider: `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, or `AWS_REGION` (with valid AWS credentials). Provider can be forced via `AI_PROVIDER=bedrock|anthropic|openrouter` env var. For web search, set `BRAVE_API_KEY` and/or `TAVILY_API_KEY` (Tavily preferred when both set). For image search, set `PEXELS_API_KEY`. For email verification, set `EMAIL_PROVIDER=ses` to use Amazon SES (reuses AWS credentials), or configure `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` for SMTP. SES sender address (`SES_FROM_EMAIL`, default `ailab@gc.cuny.edu`) must be verified in the SES console.

**Deploy to staging:** `./deploy-staging.sh` (requires Tailscale/CUNY VPN connection).

## Base Path

SvelteKit is configured with a conditional base path in `svelte.config.js`:
- Dev: no base path (routes at `/`)
- Staging: base path `/slide-maker` (routes at `/slide-maker/...`)

**All `goto()` calls and `<a href>` links MUST use `${base}/` prefix** (import from `$app/paths`). Hardcoded paths like `goto('/login')` will break on staging.

## Key Conventions

### Svelte 5 Runes
Always use runes, never Svelte 4 patterns:
- `$state()`, `$derived()`, `$effect()`, `$props()`
- `{@render children()}` not `<slot />`

### Slide Layouts (7 types)
Matching the CUNY AI Lab deck framework:
- `title-slide` — Cover slide. Zone: `hero` (centered)
- `layout-split` — Two-column (~70% of slides). Zones: `content` (left), `stage` (right). Resizable split ratio.
- `layout-content` — Full width single column. Zone: `main`
- `layout-grid` — Card grid. Zone: `main`
- `layout-full-dark` — Dark background. Zone: `main`
- `layout-divider` — Section break. Zone: `hero` (centered)
- `closing-slide` — Final slide. Zone: `hero` (centered)

### Module Types (14 types)
Do NOT invent new ones. Each module MUST specify a `zone` matching the layout.

| Module | Data Shape | Use |
|--------|-----------|-----|
| `heading` | `{ text, level: 1-4 }` | Titles, subtitles |
| `text` | `{ markdown?, html? }` | Paragraphs, formatted text (TipTap editing) |
| `card` | `{ title?, body?\|content, variant?: 'cyan'\|'navy'\|'default' }` | Colored info cards |
| `label` | `{ text, color: 'cyan'\|'blue'\|'navy'\|'red'\|'amber'\|'green' }` | Section tag badges |
| `tip-box` | `{ content, title? }` | Callout/note boxes |
| `prompt-block` | `{ content, quality?: 'good'\|'mid'\|'bad', language? }` | Code/prompt display |
| `image` | `{ src, alt, caption?, fit?, width?, height? }` | Images (API URLs auto-prefixed) |
| `carousel` | `{ items: [{src, caption?}], syncSteps? }` | Image slider |
| `comparison` | `{ panels: [{title, content}] }` | Side-by-side panels |
| `card-grid` | `{ cards: [{title, content, color?}], columns?: 2-4 }` | Multi-card grid |
| `flow` | `{ nodes: [{label, description?}] }` | Process flow with arrows |
| `stream-list` | `{ items: string[] }` | Styled bullet list |
| `artifact` | `{ artifactName?, rawSource?, config?, alt?, width?, height?, autoSize?, aspectRatio? }` | Interactive JS viz (native canvas or iframe fallback) |
| `video` | `{ url, caption? }` | Embedded video (YouTube, Vimeo, Loom) — auto-converts URLs to embeds |

Renderers: `apps/web/src/lib/components/renderers/`. Dispatched by `ModuleRenderer.svelte`.
Artifact config utilities: `apps/web/src/lib/utils/artifact-config.ts` (resolves defaults, builds `@artifact:` chat refs).

### Artifacts (Two Rendering Paths)
Artifacts render interactive visualizations. Two paths:
- **Native** — pure JS rendered into a div (no iframe). Registered in `apps/web/src/lib/modules/artifacts/` (client) and `apps/api/src/export/artifacts.ts` (export). Names listed in `NATIVE_ARTIFACT_NAMES`. Includes: A* Pathfinding, Boids, Flow Field, Harmonograph, Langton's Ant, Leaflet Map, Lorenz Attractor, Molnar, Nake, Rössler Attractor, Sprott Attractor, Timeline, Truchet Tiles.
- **Iframe fallback** — for HTML-source artifacts with `rawSource`. Used when no native factory matches. Export extracts these to `artifacts/` folder in the zip.

When adding a new artifact: create a factory in `apps/web/src/lib/modules/artifacts/`, import it in `ArtifactModule.svelte`, add the equivalent vanilla JS `register()` call in `apps/api/src/export/artifacts.ts`, and add the name to `NATIVE_ARTIFACT_NAMES`.

### Zone Model
Modules flow vertically within zones. No absolute x/y positioning.
- Layout defines which zones exist (see `LAYOUT_ZONES` in `packages/shared/src/block-types.ts`)
- Each module has a `zone` field
- Modules reorder via drag-and-drop (svelte-dnd-action on canvas, grip handle at top-left)
- Cross-zone drops supported in `layout-split` (content <-> stage). Scoped per-slide via `type: canvas-zone-${slideId}`
- Modules resize via corner drag (bottom-left and bottom-right handles, pointer events with setPointerCapture) — image and artifact modules persist dimensions via `applyMutation` (supports undo/redo). Shift-drag locks aspect ratio. Other modules scale visually via CSS `transform: scale()` (session-local)

### Canvas Rendering (Two Modes)
The canvas has two modes (`CanvasMode = 'edit' | 'view'`):
- **View mode** (default) — `SlideRenderer` with Svelte components, non-editable. Theme-driven via CSS variables. Click to switch to edit mode.
- **Edit mode** — click "Edit" button to switch. Uses SlideRenderer with TipTap editors, module picker, ▲/▼ controls. Press Escape to switch back.
- **Preview** — toolbar button opens `{API_URL}/api/decks/{id}/preview` in a new browser tab (full deck preview, not inline). Not a canvas mode — just a `window.open()` call.

### Canvas Editing (Edit Mode)
- **Format toolbar** (fixed above slide): heading levels (Normal/H1-H4), font size, bold, italic, link, bullet list, ordered list, align left/center/right. Appears when a TipTap editor is active (text, card, tip-box modules).
- **Drag handle** (top-left grip `⠿`): drag to reorder within zone or across zones (layout-split)
- **Corner resize** (bottom-left and bottom-right handles): drag to resize module. Image/artifact/video persist dimensions; others scale via `transform: scale()`. Shift-drag locks aspect ratio
- **✕ button**: delete module (double-click to confirm)
- **Step order dropdown**: set progressive reveal order (1-5) per module
- **+ Module button**: opens module picker overlay per zone (fixed position, not constrained by slide frame)
- **Split handle**: drag to resize left/right zone proportions in `layout-split`
- **Keyboard navigation:** Left/Right arrows navigate slides (skips when in editable elements). Escape returns to gallery.
- **Dark mode:** Moon icon in toolbar toggles editor dark mode (persists to localStorage). Slide themes are independent.
- **Share button:** In toolbar, opens share dialog to add collaborators by email

### AI Chat Mutations
The AI emits mutations in ` ```mutation ` fenced blocks. Applied **live during streaming** (not after).

Key mutations:
- `addSlide { layout, modules: [{ type, zone, data }] }` — creates slide with modules
- `addBlock { slideId, block: { type, zone, data } }` — adds module to existing slide
- `updateBlock`, `removeBlock`, `removeSlide`, `updateSlide`, `setTheme`

System prompt at `apps/api/src/prompts/system.ts` — includes deck state, templates, theme, and **uploaded file URLs** so AI can reference them in image modules. The AI does NOT have web access — it directs users to `/search` command for web images.

### Web Search (Brave / Tavily)
- `/search <query>` in chat — searches web, auto-downloads first image, inserts into active slide
- `POST /api/search` — searches the web via Brave Search API or Tavily (prefers Tavily if key is set, falls back to Brave). Returns `{ answer, results[], images[] }`. Brave returns `answer: null`; Tavily provides a summarized answer.
- `POST /api/search/images` — searches Pexels for openly licensed images. Returns `{ images: [{ id, url, thumbnail, alt, photographer, photographerUrl, pexelsUrl }] }`
- `POST /api/search/download-image` — downloads an image from a URL and saves it as an uploaded file
- Content filtered: inappropriate domains blocked from search and download
- SSRF protection on download-image: validates URLs resolve to public IPs, blocks private ranges, no redirect following
- Search provider config in `.env`: `BRAVE_API_KEY` and/or `TAVILY_API_KEY` (at least one required). `PEXELS_API_KEY` for image search.
- Provider logic at `apps/api/src/routes/search.ts`: `searchViaTavily()` and `searchViaBrave()` functions with shared `SearchResult` response type
- The AI does NOT have web access — tell users to use `/search` for web images

### File Uploads
- Upload via Files tab, drag into chat input, or `/search` auto-download
- Stored at `apps/api/uploads/{deckId}/{fileId}{ext}` (symlinked to `/data/slide-maker-storage/uploads/`)
- Served at `/api/decks/:deckId/files/:fileId` (no auth, cached)
- File paths in DB may be absolute or relative — serve handler resolves both via `path.isAbsolute()` check
- `ImageModule` auto-prefixes `API_URL` for paths starting with `/api/`
- Export rewrites API URLs to local `assets/` paths in zip

### Persistence
All mutations persist to API immediately. Pattern:
1. Call API endpoint (POST/PATCH/DELETE)
2. Update local Svelte store with response
3. Canvas re-renders reactively

**API response shapes:** The API often returns data at the top level (not nested under a key). Always handle both: `result.slide ?? result`, `result.deck ?? result`.

### Export
Produces self-contained HTML decks matching the CUNY AI Lab framework:
- `css/styles.css` — layout classes, module styles, step reveals, responsive typography with `clamp()`
- `js/engine.js` — deck-engine (keyboard nav, step system, carousel sync, scrubber, ARIA announcements)
- `js/artifacts.js` — native artifact renderers (canvas visualizations, maps, etc.)
- `assets/` — bundled uploaded images with rewritten URLs
- `artifacts/` — extracted iframe-based artifact HTML files (only if non-native artifacts exist)
- Export code: `apps/api/src/export/` (framework-css.ts, navigation.ts, carousel.ts, artifacts.ts, html-renderer.ts, index.ts)
- Framework CSS lives in `packages/shared/src/framework-css.ts` — single source of truth for module/layout styles. Three exports: `FRAMEWORK_CSS_BASE` (shared), `FRAMEWORK_CSS_EXPORT` (multi-slide deck), `FRAMEWORK_CSS_PREVIEW` (single-slide iframe). Both the API export and client preview import from here.

## Server Storage

The staging server has two drives:
- **Root drive** (`/`) — 8.9GB, nearly full. Do NOT store data here.
- **Data drive** (`/data`) — 2TB, plenty of space. ALL app data lives here.

Storage layout on server:
```
/data/slide-maker/                    ← app code (git repo)
/data/slide-maker-storage/
  ├── db/slide-maker.db               ← SQLite database
  ├── uploads/{deckId}/{fileId}.ext    ← uploaded files
  └── exports/                        ← (reserved for future use)
```

`apps/api/data` and `apps/api/uploads` are **symlinks** to `/data/slide-maker-storage/`. If you need to add more storage paths, put them under `/data/slide-maker-storage/` and symlink.

**Upload limits:** 10MB per file, 50MB total per deck.

## Database

SQLite at `apps/api/data/slide-maker.db` (symlinked to `/data/slide-maker-storage/db/`). Schema at `apps/api/src/db/schema.ts`.

Key tables:
- `slides` — layout, splitRatio, order
- `content_blocks` — type, zone, data (JSON), order, stepOrder
- `templates` — layout, modules (JSON)
- `artifacts` — name, description, type (chart/map/diagram/visualization), source (URL or raw HTML), config (JSON), builtIn flag
- `themes` — name, colors, fonts, CSS, builtIn flag
- `users`, `sessions`, `emailVerifications`, `decks`, `deck_access`, `uploaded_files`, `chat_messages`, `deck_locks`, `deckPresence`

Push schema changes: `pnpm db:push` (runs `drizzle-kit push` from `apps/api/`).

### Token Usage Tracking
- `token_usage` table records estimated tokens per chat message (input + output, ~4 chars per token)
- Users have `tokenCap` (default 1M) and annual reset
- Chat route checks cap before streaming — returns 429 if exceeded
- Admin can set custom caps per user

## Auth

- Email/password with `*.cuny.edu` domain gating
- Registration → email verification → admin approval → login
- Email sent via Amazon SES (`@aws-sdk/client-ses` through nodemailer SES transport). Sender: `ailab@gc.cuny.edu` (verified as individual email identity — no DNS/domain verification). Set `EMAIL_PROVIDER=ses` in `.env`. Falls back to SMTP if `EMAIL_PROVIDER` is unset and `SMTP_HOST` is configured. Email code at `apps/api/src/email/index.ts`.
- Admins can create pre-approved users from the admin panel (`POST /api/admin/users`)
- Users can change their own password from the gallery header (`POST /api/auth/change-password`, rate limited 5/15min)
- Lucia v3 sessions (HTTP-only cookies)
- Admins: Stefano Morello (smorello@gc.cuny.edu), Zach Muhlbauer (zmuhlbauer@gc.cuny.edu)

## Admin Dashboard

Full admin panel at `/admin` with:
- **Stats cards:** Total Users, Pending Approval, Total Decks, Total Tokens Used
- **User table:** All users with name, email, role (editable dropdown), status, deck count, tokens used, cap (click-to-edit), last active, actions
- **Sortable + filterable** by any column / status
- **Token usage modal:** Monthly bar chart, model breakdown, cap progress bar
- **Create user:** `+ Add User` button — creates pre-approved, email-verified accounts (enforces CUNY email)
- **API routes:** `GET /api/admin/users/all`, `POST /api/admin/users` (create), `PATCH /api/admin/users/:id`, `GET /api/admin/users/:id/usage`

**Svelte 5 gotcha:** `$derived.by(() => { ... })` returns a VALUE. Don't call it as `filteredUsers()` in templates — use `filteredUsers` directly. `$derived(expr)` is for simple expressions only.

## Deployment

- **Dev:** `pnpm dev` (localhost:5173 + localhost:3001)
- **Staging:** `tools.cuny.qzz.io/slide-maker` — Debian server (Tailscale IP 100.111.252.53), Nginx reverse proxy, PM2 processes (`slide-maker-api` on port 3004, `slide-maker-web` on port 4173)
- **Deploy:** `./deploy-staging.sh` from a machine on Tailscale/CUNY VPN. GitHub Actions can't reach the server (Tailscale-only IP).
- **Server deploy script:** `/data/slide-maker/deploy.sh` — git pull, pnpm install, build, db push, seed, pm2 restart
- **SSH:** `sshpass -p "<password>" ssh -o StrictHostKeyChecking=no smorello.adm@gc.cuny.edu@100.111.252.53`
- **Traffic flow:** Browser → Cloudflare (`tools.cuny.qzz.io`) → Caddy (TLS on 146.96.128.38) → Nginx (:80) → PM2 apps
- **PM2 API start:** `pm2 start "pnpm --filter @slide-maker/api dev" --name slide-maker-api` (must use tsx/dev, not compiled dist — shared package exports raw .ts)
- **PM2 Web start:** `pm2 start /usr/bin/node --name slide-maker-web -- <vite-bin-path> preview --host 0.0.0.0 --port 4173` (run from `apps/web/`, `npx` not available in sudo env)
- **Nginx config:** `/etc/nginx/sites-enabled/alt-text.conf` contains routes for ALL apps (alt-text, asr, ocr, site-studio, agent-studio, hm-review, slide-maker). Never use `sed` on it — edit manually or append carefully. Always `nginx -t` before `systemctl reload nginx`.
- **Root disk is only 8.9GB** — `/var/log` symlinked to `/data/var-log`, `/home` contents moved to `/data/home-moved/` with symlinks. Monitor with `df -h /`. If disk fills, check `/var/cache/apt` and run `apt-get clean`.
- **Debug routes:** Require `ENABLE_DEBUG_ROUTES=true` in `.env` (explicit opt-in). Exposes transcript viewer at `/api/debug/transcripts`.

### Other Apps on the Server
- **HM Review:** `/home/smorello.adm/hm-review`, Flask + gunicorn on port 8010, PM2 name `hm-review`. Must use `wsgi:app` (not `app:create_app()`) — `wsgi.py` applies `PrefixMiddleware` for `/hm` path prefix. Nginx passes full `/hm/` path to app.

## Docs

- Vision: `slide-builder-prompt-pt1.md`
- Specs: `docs/superpowers/specs/2026-03-28-slide-maker-v{1,2,3}-design.md`
- Plans: `docs/superpowers/plans/2026-03-28-slide-maker-v{1,2,3}.md`
- A11y audits: `docs/a11y-audit-*.md`
- Security audit: `docs/security-audit-2026-03-28.md`
- Block docs (AI prompt reference): `docs/JS_SLIDE_MAKER_BLOCKS.md`
- Frontend roadmap: `docs/roadmap-frontend-optimization.md`
- QA reports: `docs/qa-reports/`
- Wireframes: `docs/wireframes/`

### Themes
- 12 built-in themes in 6 light/dark families: Studio (Dark, Light), CUNY AI Lab (Default, Dark), Warm Academic (Light, Dark), Slate Minimal (Light, Dark), Midnight (Dark, Light), Forest (Light, Dark)
- Theme-driven rendering: both preview iframe and export apply theme colors/fonts via CSS variables
- Auto-detects dark/light themes for text contrast (uses luminance calculation)
- Theme store at `apps/web/src/lib/stores/themes.ts`
- Users can create custom themes and fork existing ones via the Themes tab

### Undo/Redo
- `Ctrl+Z` / `Ctrl+Shift+Z` in the editor
- History store at `apps/web/src/lib/stores/history.ts`
- Tracks addSlide, addBlock, updateBlock, reorderBlocks, reorderSlides, moveBlockToZone mutations with reverse operations
- All DnD reorder/cross-zone and resize operations go through `applyMutation` for undo support

### Security
- CSP + security headers via `apps/web/src/hooks.server.ts`
- DOMPurify on all user HTML content in renderers
- sanitize-html on API export renderer
- CSRF middleware on API (`hono/csrf`)
- Body limit: 11MB for file upload routes, 2MB for everything else
- Rate limiting via `rate-limiter-flexible` (`apps/api/src/middleware/rate-limit.ts`):
  - Login: 5 attempts per 15 minutes
  - Registration: 3 per hour
  - Chat: 30 messages per minute
  - Password change: 3 per 15 minutes
  - Heartbeat: excluded from rate limiting
- Admin role middleware at `apps/api/src/middleware/admin.ts` — enforces admin role (403 if not admin)
- Admin role check is client-side only (server-side guard removed — it broke on staging due to SvelteKit server not proxying to API)
- Block ownership verification on CRUD endpoints
- Export path traversal guard (`path.basename()`)
- Link URL validation (https only)
- Content filtering on web search (blocked domains)
- Security audit: `docs/security-audit-2026-03-28.md`

- `/artifact?b64=` endpoint requires auth cookie — prevents unauthenticated same-origin XSS
- `postMessage` handler in ArtifactModule validates `event.origin` (same-origin or `null` for srcdoc only)
- File serving (`/api/decks/:id/files/:fileId`) uses `Cache-Control: private` — prevents CDN caching of uploaded files
- SSRF guard double-resolves DNS to mitigate rebinding TOCTOU attacks
- Preview HTML response includes CSP + `X-Frame-Options: DENY`
- Native artifacts (JS primitives) run unsandboxed in the main page DOM — no iframe isolation. This is safe because only hardcoded first-party factory functions in `apps/web/src/lib/modules/artifacts/` are registered. Do NOT open the artifact registry to user-supplied code without adding a sandbox boundary.
- Debug routes (`/api/debug/*`) require `ENABLE_DEBUG_ROUTES=true` env var AND admin auth. Never enable on production.
- Slide insertion uses raw better-sqlite3 sync transaction (not Drizzle's async wrapper) to prevent order race conditions.
- In-memory rate limiter (`RateLimiterMemory`) resets on PM2 restart — known limitation, acceptable for staging.

**Do not revert security changes in:** `decks.ts`, `files.ts`, `chat.ts`, `auth.ts`, `index.ts`, `export/index.ts`, `export/html-renderer.ts`, `lucia.ts`

### UI Design System
Editor chrome uses CSS custom properties defined in `apps/web/src/app.css`. Key tokens:
- Brand: `--navy`, `--blue`, `--teal`, `--stone` (CUNY palette)
- Ghost buttons: `--color-ghost-bg` (8% blue tint), `--color-ghost-bg-hover` (12%) — all interactive buttons use ghost/outlined style, no filled backgrounds
- Radius: `--radius-sm: 6px` — default for all interactive elements
- No CSS framework (pure CSS + custom properties). No Tailwind.

Buttons across the app follow a ghost pattern: transparent background, 1px border in `var(--color-primary)`, text in `var(--color-primary)`, with `var(--color-ghost-bg)` hover tint. Do not introduce filled-background buttons.

## Testing

Vitest at root level. Config: `vitest.config.ts`. Tests: `tests/**/*.test.ts`. Currently 613 tests across 18 files. Shell check scripts (8) in `tests/*.sh` via `tests/run_all.sh`. Playwright E2E specs (5) in `e2e/`.

- `tests/artifact-config.test.ts` — artifact config resolution (`getResolvedConfig`, `buildAtRef`)
- `tests/artifact-runtime.test.ts` — artifact runtime helpers
- `tests/canonical-template.test.ts` — template structure validation
- `tests/dnd-transforms.test.ts` — DnD pure transform functions (reorderBlocksInZone, moveBlockBetweenZones, reorderSlides)
- `tests/export-artifacts.test.ts` — artifact export pipeline
- `tests/export-zip-integration.test.ts` — full export ZIP structure
- `tests/framework-css.test.ts` — CSS specificity, layout rules, variant correctness
- `tests/html-renderer-modules.test.ts` — HTML renderer output for all 14 module types
- `tests/module-type-parity.test.ts` — renderer/prompt/phantom type parity across shared package
- `tests/outline-parser.test.ts` — outline markdown parsing
- `tests/outline-pipeline-10.test.ts` — outline import pipeline (slide generation from parsed outline)
- `tests/resource-registry.test.ts` — resource registry validation
- `tests/rich-text.test.ts` — rich text pipeline (markdown, HTML, sanitization)
- `tests/slide-budget.test.ts` — slide budget estimation from outline
- `tests/slide-layout.test.ts` — layout zone validation
- `tests/ssrf-guard.test.ts` — SSRF protection for URL fetching
- `tests/system-prompt-*.test.ts` — system prompt docs and render diagnostics

Tests import directly from `packages/shared/src/` and `apps/web/src/lib/utils/`. SvelteKit aliases (`$lib/`) don't resolve in vitest — test only pure TS utilities, not Svelte components.

### Sharing & Collaboration API
- `GET /api/decks/users/search` — search users by name/email for sharing
- `POST /api/decks/:id/share` — share deck with another user (sends email notification via SES, fire-and-forget)
- `DELETE /api/decks/:id/share/:userId` — revoke shared access
- `GET /api/decks/:id/collaborators` — list deck collaborators
- `POST /api/decks/:id/lock` — acquire pessimistic edit lock (5-min TTL)
- `DELETE /api/decks/:id/lock` — release lock
- `POST /api/decks/:id/lock/heartbeat` — refresh lock TTL
- `POST /api/decks/:id/presence` — upsert presence heartbeat (30s client interval, 2-min TTL, auto-cleans stale)
- `DELETE /api/decks/:id/presence` — remove presence on leave
- `GET /api/decks/:id/presence` — list active users on a deck
- Route file: `apps/api/src/routes/sharing.ts`
- PresenceBar component: `apps/web/src/lib/components/canvas/PresenceBar.svelte` — shows "Also here:" badges
- Lock heartbeat only runs when lock is held; presence heartbeat always runs while on a deck
- **Locking is advisory only** — mutations are not gated on lock ownership. Two editors can overwrite each other (last write wins). Lock enforcement and conflict detection are planned but not yet implemented.

## Resources API

- `GET /api/templates` — all seeded slide templates
- `GET /api/themes` — all themes (built-in + user-created)
- `POST /api/themes` — create custom theme (auth required, validates hex colors and font names to prevent CSS injection)
- `DELETE /api/themes/:id` — delete custom theme (owner only, not built-in)
- `GET /api/artifacts` — all artifact definitions

### Client-Side Resource Registry
All resources (templates, themes, artifacts) are managed through centralized Svelte stores with fetch-once guards:

- `apps/web/src/lib/stores/templates.ts` — `templatesStore`, `ensureTemplatesLoaded()`, `findTemplateById()`
- `apps/web/src/lib/stores/themes.ts` — `themesStore`, `ensureThemesLoaded()`, `createTheme()`, `deleteTheme()`
- `apps/web/src/lib/stores/artifacts.ts` — `artifactsStore`, `ensureArtifactsLoaded()`, `findArtifactByName()`
- `apps/web/src/lib/stores/resources.ts` — unified aggregator, re-exports all stores + `ensureAllResourcesLoaded()`

**Do not bypass these stores.** UI components should read via `$derived($store)` and call `ensure*Loaded()` in an `$effect`, not do their own `fetch()` calls. Mutations (create/delete theme) should use the store helpers, not inline fetch + `store.update()`. `mutations.ts` uses dynamic `import()` for store access to avoid circular dependencies.

## Known Issues / Tech Debt

- PreTeXtBook/pretext is a server-side Python toolchain, NOT a browser JS library. `@chenglou/pretext` was previously used for text measurement but was removed — its inline styles were overridden by `framework-preview.css` `!important` rules, making it entirely inert. All text sizing uses CSS `clamp()` with `cqi` units.
- svelte-dnd-action used for both outline (slide/block reorder) and canvas (module drag-and-drop with cross-zone support in layout-split). Drag handle (`.canvas-drag-handle`) at top-left of modules, resize handle at bottom-right — no gesture conflict. All DnD operations go through `applyMutation` for undo/redo support.
- Step reveals render in both inline preview (via `slide-html.ts` `wrapStep()`) and full deck preview (via export `stepAttrs()`). The inline preview CSS overrides `step-hidden` to `opacity: 1` so all steps are visible; the full deck preview uses navigation JS to reveal steps on click/arrow.
- Export doesn't include speaker notes panel yet.
- No real-time collaborative editing — uses pessimistic locking (5-min TTL with heartbeat) and polling-based presence (30s). Locking is advisory only; mutations are not gated on lock ownership.
- **TipTap font-size passthrough (UNSOLVED):** Font size set via FormatToolbar (`setFontSize()`) applies `<span style="font-size: Xpx">` within TipTap HTML content stored in `data.text`. This inline font-size does NOT render in the full deck preview (`/api/decks/:id/preview`). The preview uses `FRAMEWORK_CSS_EXPORT` (vw-based typography) via `apps/api/src/routes/preview.ts`. The html-renderer (`apps/api/src/export/html-renderer.ts`) sanitizes heading text and strips `<p>` wrappers, and `sanitize-html` config allows `font-size` on `<span style>`. The sanitized output contains the correct `<span style="font-size:32px">` inside `<h1>`, but the rendered preview still shows default clamp sizes. Root cause is unknown — needs browser DevTools inspection of the actual preview DOM to identify what CSS rule or DOM mutation is overriding the inline span font-size. Canvas-side DOMPurify was also updated to `ADD_ATTR: ['style']` but may have the same issue.
- `adapter-auto` warning on build — could switch to `adapter-node` for production.
- Email verification is live on staging via Amazon SES (sender: `ailab@gc.cuny.edu`). Admin approval is still required after email verification.
- `.env` symlink (`apps/api/.env -> ../../.env`) must exist or the API won't load any API keys. If chat shows "No models available", recreate the symlink and restart `pnpm dev`.
- Undo for `applyTemplate` replace path uses a pre-template snapshot (`_restoreSlide`). If the user edits the slide after applying a template and then undoes, the intermediate edits are lost. Standard undo behavior, but a richer approach (e.g. per-block diffing or undo stack per slide) may be warranted if users report data loss.
- **Drizzle + better-sqlite3 transactions:** `db.transaction()` rejects async callbacks AND sync callbacks containing Drizzle query builders (they return thenables). Use raw `sqlite.transaction()` from `apps/api/src/db/index.ts` for atomic operations. See `decks.ts` addSlide for the pattern.

## Session Hand-Off Prompts

When completing a significant session of work, ask the user whether they'd like a hand-off prompt logged to `docs/prompts/`. These are structured markdown briefs with checkboxes that contextualize progress, audit needs, and next steps for the next Claude Code instance or human collaborator picking up the work. See `docs/prompts/` for examples.
