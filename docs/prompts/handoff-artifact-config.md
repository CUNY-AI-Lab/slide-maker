# Slide-Maker: Handoff Brief — Rich Artifact Configuration System

> **For**: Next Claude Code instance or human collaborator
> **From**: Instance that designed the artifact config system
> **Date**: 2026-03-31
> **Plan reference**: `.claude/plans/scalable-orbiting-matsumoto.md`

---

## Background

You are picking up work on `slide-maker`, a chat-driven slide builder for the CUNY AI Lab. The goal is to make JS visualization artifacts (Lorenz, Boids, Truchet, etc.) configurable via typed JSON parameters that the AI agent can read and mutate through chat, and users can edit in the Resources panel.

This is designed as the prototype for a general `@resource:id` reference system that will later extend to themes, templates, and files.

---

## What Was Designed (Not Yet Implemented)

The design is fully specified in the plan file above. Key decisions:

1. **Schema-in-template** — each artifact JSON defines its own typed config schema (`{ type, label, default, min?, max?, step?, options? }` per field)
2. **Tiered system prompt** — index (all artifacts, 1 line each), active (in-deck, with resolved config values + slide positions), focused (@-referenced, with full schema including types/ranges). Scales to 1000+ resources.
3. **`updateArtifactConfig` mutation** — new verb targeting by artifact name, applies to all instances in deck. Client-side macro expanding to `updateBlock` calls. No new API endpoint needed.
4. **Config bootstrap** — standard JS preamble in each artifact reads `data-config` from `<body>` DOM attribute, falls back to hardcoded defaults via `??` pattern
5. **Artifact identity** — inserted blocks carry `artifactId`, `artifactName`, `config` fields for reliable matching

---

## Implementation Checklist

### Step 1: Shared Types
- [ ] Add `ArtifactConfigField`, `ArtifactConfigSchema` to `packages/shared/src/block-types.ts`
- [ ] Add `updateArtifactConfig` to `Mutation` union in `packages/shared/src/mutations.ts`
- [ ] Move canonical types from `apps/web/src/lib/utils/artifact-config.ts` to shared, re-export

### Step 2: Template Schemas (12 artifacts)
- [ ] lorenz.json — particleCount, sigma, rho, beta, trailLength, speed
- [ ] boids.json — count, maxSpeed, separation/alignment/cohesion radii + weights
- [ ] truchet.json — mode, tileSize, flipInterval, lineWidth, palette
- [ ] flow.json — particleCount, noiseScale, maxSpeed, damping, hueStart, hueRange
- [ ] astar.json — cellSize, animSpeed, mazeOnStart
- [ ] harmonograph.json — damping, stepsPerFrame, hue
- [ ] rossler.json — a, b, c, trailLength, speed
- [ ] sprott.json — system, trailLength, autoRotate
- [ ] langton.json — cellSize, stepsPerFrame, startingAnts
- [ ] tenprint.json — cellSize, lineWidth, color, bgColor
- [ ] molnar.json — gridCols, gridRows, disruption
- [ ] nake.json — gridCols, gridRows, maxSubdivision

### Step 3: Config Bootstrap in JS Source
- [ ] Add standard config preamble to all 12 artifact source strings
- [ ] Replace hardcoded constants with `cfg.param ?? default` pattern
- [ ] Verify standalone rendering still works (no data-config = all defaults)

### Step 4: Block Identity
- [ ] Update `insertArtifact()` in ArtifactsTab to include artifactId, artifactName, config
- [ ] Move `buildSourceWithConfig` from ArtifactsTab to `artifact-config.ts`
- [ ] Update ArtifactModule.svelte to inject config from block data into rawSource before blob

### Step 5: Mutation Handler
- [ ] Create `apps/web/src/lib/stores/artifacts.ts` — cache artifact definitions from API
- [ ] Add `updateArtifactConfig` case in `apps/web/src/lib/utils/mutations.ts` applyMutation
- [ ] Implement: find blocks by name/alt, merge config, rebuild source, call updateBlock per block
- [ ] Wire undo (reverse mutation with old config values)

### Step 6: Tiered System Prompt
- [ ] Restructure artifacts section in `apps/api/src/prompts/system.ts` — tier 1 index (always)
- [ ] Add tier 2: active artifacts with config + slide positions
- [ ] Add tier 3: focused artifacts with full schema, triggered by `@artifact:` in user message
- [ ] Update `apps/api/src/routes/chat.ts` to scan message for @artifact: refs and deck for active artifacts

### Step 7: AI Instructions
- [ ] Document `updateArtifactConfig` in system prompt mutation actions list
- [ ] Add artifact config rules (partial update, name targeting, natural language resolution)
- [ ] Add few-shot examples (e.g. "make the boids faster")

### Step 8: Testing
- [ ] Extend `tests/artifact-config.test.ts` for schema configs, merge, buildSourceWithConfig
- [ ] Add mutation parsing test for updateArtifactConfig in `tests/mutations.test.ts`
- [ ] Add system prompt tiered serialization test in `tests/system-prompt.test.ts`
- [ ] Manual: each of 12 artifacts renders with defaults and responds to config changes

---

## Key Architecture Decisions

- **No new API endpoint** — `updateArtifactConfig` is a client-side macro expanding to `updateBlock` calls via the existing `PATCH /api/decks/:id/slides/:slideId/blocks/:blockId` endpoint
- **`data-config` attribute on `<body>`** is the injection point (already used by `buildSourceWithConfig` in ArtifactsTab)
- **`?? defaultValue` pattern** ensures artifacts work standalone without any config (backwards compat with creative-clawing.com gallery and old deck blocks)
- **Tiered prompt** keeps token cost bounded: 1000 artifacts = ~1000 index lines, only 2-3 active + 1-2 focused get expanded
- **`artifactName` matching** with `data.alt` fallback for old blocks that don't have identity fields

## Critical Files

| File | Role |
|------|------|
| `packages/shared/src/mutations.ts` | Mutation union type — add `updateArtifactConfig` |
| `packages/shared/src/block-types.ts` | Shared types — add `ArtifactConfigField`, `ArtifactConfigSchema` |
| `apps/web/src/lib/utils/mutations.ts` | Client mutation handler — add `updateArtifactConfig` case |
| `apps/web/src/lib/utils/artifact-config.ts` | Config resolution + `buildSourceWithConfig` (canonical location) |
| `apps/web/src/lib/components/resources/ArtifactsTab.svelte` | Insert flow — add identity fields to block data |
| `apps/web/src/lib/components/renderers/ArtifactModule.svelte` | Renderer — inject config into rawSource before blob |
| `apps/api/src/prompts/system.ts` | System prompt — tiered serialization + AI instructions |
| `apps/api/src/routes/chat.ts` | Chat route — pass richer artifact context to prompt builder |
| `templates/artifacts/*.json` (x12) | Template schemas + JS config bootstrap |

## Out of Scope (Future Work)

- Typed UI config editor (sliders, color pickers) — replace JSON textarea
- Extend `@` reference system to themes, templates, files
- Real-time config preview while editing textarea
- Artifact source hosting / CDN
- Config versioning beyond undo/redo
