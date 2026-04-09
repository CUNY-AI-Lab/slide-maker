# Slide Maker

Chat-driven slide builder for the CUNY AI Lab. Create presentation decks through AI conversation and direct on-canvas editing.

## Contributor Guide

See Repository Guidelines in `AGENTS.md` for project structure, local dev commands, coding style, testing, and commit conventions.

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 9.x (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   Copy the example env file and fill in your keys:

   ```bash
   cp .env.example .env.development
   ```

   Required variables:
   - `SESSION_SECRET` — any random string for auth sessions
   - One provider configured for AI chat (pick any):
     - OpenRouter: set `OPENROUTER_API_KEY`
     - Anthropic: set `ANTHROPIC_API_KEY`
     - AWS Bedrock: set `AWS_REGION` and provide AWS credentials (env/CLI/profile)
   - Optional: `TAVILY_API_KEY` — web search (`/search` command)

   The `.env` file at the root is symlinked into `apps/api/.env` and `apps/web/.env`.

3. **Initialize the database**

   ```bash
   pnpm db:push    # apply schema to SQLite
   pnpm db:seed    # seed templates, default theme, admin users
   ```

## Running

```bash
pnpm dev
```

This starts both services via Turborepo:

| Service | URL |
|---------|-----|
| Web (SvelteKit) | http://localhost:5173 |
| API (Hono) | http://localhost:3001 |

## Provider Selection

- Easiest commands:

  - `pnpm dev:bedrock` — run web + API using AWS Bedrock
  - `pnpm dev:anthropic` — run web + API using Anthropic SDK
  - `pnpm dev:openrouter` — run web + API using OpenRouter

- API-only commands (optional):

  - `pnpm api:bedrock`
  - `pnpm api:anthropic`
  - `pnpm api:openrouter`

- Or select via env var (works with `pnpm dev`):

  - `AI_PROVIDER=bedrock pnpm dev`
  - `AI_PROVIDER=anthropic pnpm dev`
  - `AI_PROVIDER=openrouter pnpm dev`

- Or pass a CLI flag when starting the API only:

  - `pnpm start -- --provider bedrock`

Notes
- Bedrock requires `AWS_REGION` and valid AWS credentials. The SDK uses the default AWS credential chain.
- Models exposed:
  - Bedrock: Haiku 4.5 (`anthropic.claude-haiku-4-5-20251001-v1:0`). Sonnet 4.6 is admin-only; override ID with `BEDROCK_SONNET_46_MODEL_ID` if needed.
  - Anthropic SDK: Sonnet 4 and Haiku 4.5. Sonnet 4.6 can be enabled admin-only via `ANTHROPIC_SONNET_46_MODEL_ID`.
- If `AI_PROVIDER` is set, the UI model list and chat streaming are limited to that provider.

## Project Structure

```
apps/api/        -- Hono API server (Node, SQLite, Drizzle ORM, Lucia auth)
apps/web/        -- SvelteKit frontend (Svelte 5, TipTap editor)
packages/shared/ -- Shared TypeScript types and constants
templates/       -- Seeded slide template JSON files
```

## Other Commands

```bash
pnpm build       # production build (both apps)
pnpm db:push     # push Drizzle schema changes to SQLite
pnpm db:seed     # re-seed templates and themes
pnpm seed:admin  # seed admin users only
```

## Deployment

Staging deploys to `tools.cuny.qzz.io/slide-maker` via `./deploy-staging.sh` (requires Tailscale/CUNY VPN).
