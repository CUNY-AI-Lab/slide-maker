# Slide Maker

Chat-driven slide builder for the CUNY AI Lab. Create presentation decks through AI conversation and direct on-canvas editing. Three-panel UI: chat + outline (left), canvas (center), resources (right). Exports self-contained HTML decks matching the CUNY AI Lab deck framework.

## Quickstart

```bash
pnpm install
cp .env.example .env
ln -s ../../.env apps/api/.env
pnpm db:push
pnpm db:seed
pnpm dev
```

Open http://localhost:5173, log in with a seeded admin account, create a deck, and start chatting.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9.x (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Setup

1. **Install dependencies**

   The pinned CAIL packages require authorized GitHub Packages read access. The checked-in `.npmrc` contains registry resolution only; supply credentials through your user configuration or CI environment.

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ln -s ../../.env apps/api/.env   # required — API loads env from its own CWD
   ```

   Configure institutional identity and Gateway as described in [the receiver guide](docs/fleet-integration.md). Local password sessions are development-only; production requires signed institutional identity and an operator-verified local account mapping. Provider keys are not used by Slide Maker.

3. **Initialize the database**

   ```bash
   pnpm db:push    # apply Drizzle schema to SQLite
   pnpm db:seed    # seed templates, themes, and admin users
   ```

## Running

```bash
pnpm dev
```

Starts both services via Turborepo:

| Service | URL |
|---------|-----|
| Web (SvelteKit) | http://localhost:5173 |
| API (Hono) | http://localhost:3001 |

### Models and identity

Chat and planning use the CAIL Gateway catalog and verified Gateway credentials. Gateway owns quota admission and accounting. Before serving an existing database with this version, run the additive identity migration and verify account mappings; see [the operator and release guide](docs/fleet-integration.md).

## Features

### AI chat

Conversational slide creation with SSE streaming. The AI emits structured mutations (addSlide, updateBlock, setTheme, etc.) applied live during streaming. Upload PDFs and DOCX files for context. Select models per conversation via dropdown.

Rich text formatting in the chat input: bold, italic, links, lists.

### Canvas editor

Two-mode canvas (view / edit). Edit mode provides:
- Format toolbar (heading levels, font size, bold, italic, link, lists, alignment)
- Drag-and-drop reorder within and across zones (svelte-dnd-action)
- Corner-drag resize for images and artifacts (pointer capture, shift for aspect lock)
- Module picker overlay per zone
- Split-panel resize handle for `layout-split`
- Step-reveal ordering (1-5) per module
- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`)

### Slide layouts (7)

| Layout | Zones | Use |
|--------|-------|-----|
| `title-slide` | hero | Cover slide |
| `layout-split` | content, stage | Two-column (resizable ratio) |
| `layout-content` | main | Full-width single column |
| `layout-grid` | main | Card grid |
| `layout-full-dark` | main | Dark background |
| `layout-divider` | hero | Section break |
| `closing-slide` | hero | Final slide |

### Content modules (14)

`heading` `text` `card` `label` `tip-box` `prompt-block` `image` `carousel` `comparison` `card-grid` `flow` `stream-list` `artifact` `video`

Modules flow vertically within zones. TipTap rich text editing across all module renderers. 35 seeded templates across all layouts.

### Interactive artifacts

13 built-in artifacts rendered natively (no iframe):

A* Pathfinding, Boids, Flow Field, Harmonograph, Langton's Ant, Leaflet Map, Lorenz Attractor, Molnar, Nake, Rössler Attractor, Sprott Attractor, Timeline, Truchet Tiles

Each artifact has a configurable parameter schema (numbers, colors, selects). Artifacts auto-size with aspect ratio preservation.

### Web and image search

`/search <query>` in chat searches the web (Tavily or Brave) and auto-downloads the first image into the active slide. Dedicated image search via Pexels for openly-licensed photos. SSRF protection on all URL downloads.

### Themes

12 built-in themes in 6 light/dark families: Studio (Dark, Light), CUNY AI Lab (Default, Dark), Warm Academic (Light, Dark), Slate Minimal (Light, Dark), Midnight (Dark, Light), Forest (Light, Dark). Users can create custom themes and fork existing ones. Theme-driven rendering via CSS custom properties.

### Export

Exports a self-contained ZIP with:
- `index.html` — full presentation with section nav, step reveals, carousel sync
- `css/styles.css` — framework layout and module styles
- `js/engine.js` — keyboard navigation, step system, scrubber, ARIA announcements
- `js/artifacts.js` — native artifact renderers
- `assets/` — bundled uploaded images
- `artifacts/` — extracted iframe-based artifact HTML (if any)

### Auth

Production uses verified institutional JWTs mapped explicitly to existing local user IDs. Product roles and sharing remain local. Development retains Lucia password sessions.

### Admin dashboard

User management and local product role assignment. Gateway owns current model quota; existing local usage records are historical.

## Project structure

```
apps/api/        — Hono API (Node, SQLite via better-sqlite3 + Drizzle, Lucia auth)
apps/web/        — SvelteKit frontend (Svelte 5 runes, TipTap editor)
packages/shared/ — Shared TypeScript types, constants, framework CSS
templates/       — Seeded slide and artifact template JSON (35 files)
tests/           — Vitest unit tests (695 tests, 20 files) + 8 shell check scripts
e2e/             — Playwright E2E tests (15 specs)
```

## Commands

```bash
pnpm install          # install all deps
pnpm dev              # run API + web via Turborepo
pnpm build            # production build
pnpm db:push          # push Drizzle schema to SQLite
pnpm db:seed          # seed templates, themes, admin users
pnpm seed:admin       # seed admin users only
pnpm audit:a11y       # WCAG AA/AAA contrast audit
pnpm test             # run vitest + shell checks
pnpm test:e2e         # run Playwright E2E tests
pnpm test:e2e:ui      # Playwright UI mode
npx vitest run        # run vitest only
npx vitest --watch    # watch mode
```

## Deployment

Institutional integration is source-only until the receiver release and private reachability are reviewed. See [the release proposal](docs/fleet-integration.md). Historical staging scripts are not authorization to deploy this branch.

## Contributing

See `AGENTS.md` for coding style, testing guidelines, and commit conventions.
