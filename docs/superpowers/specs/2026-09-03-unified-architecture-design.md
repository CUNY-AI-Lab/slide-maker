# Slide Maker — Unified Architecture Design

**Date:** 2026-09-03
**Status:** Proposal (alternative path, substantial refactor)
**Scope:** Replace the parallel per-surface implementations of the deck model with one shared core consumed by thin hosts. The product model (7 layouts, 14 modules, zones, chat mutations, export framework) does not change.

---

## 1. Why revisit the architecture

The v3 spec (`2026-03-28-slide-maker-v3-design.md`) got the domain model right: a deck is a list of slides, each slide has a layout with named zones, modules flow vertically inside zones, and the AI edits the deck by emitting mutations. That model is stable and should stay.

What grew around it is a different story. Each concern (rendering, styling, mutations, artifacts, theming, markdown, loading a deck) was implemented once per surface, and the surfaces multiplied: canvas edit, canvas view, iframe preview, zip export, chat, planner. The repository now carries two dedicated audit agents (`.claude/agents/css-parity.md`, `.claude/agents/rendering-parity.md`) and a parity test (`tests/module-type-parity.test.ts`) whose only job is to detect drift between copies. The "Known Issues" section of `CLAUDE.md` is mostly a catalogue of seams between those copies.

### 1.1 Inventory: the same deck, implemented five times

| Concern | Copies today | Where |
|---|---|---|
| Module rendering | 3 (one dead) | Svelte renderers `apps/web/src/lib/components/renderers/` (4,519 lines); server `apps/api/src/export/html-renderer.ts` (600 lines); `apps/web/src/lib/utils/slide-html.ts` (378 lines, zero importers, listed as "deleted" in `docs/roadmap-frontend-optimization.md`, listed as "ignore" in `CLAUDE.md`) |
| Framework CSS | 3 | `packages/shared/src/framework-css.ts` (428 lines, BASE/EXPORT/PREVIEW strings); `apps/web/src/lib/framework-preview.css` (252 lines, 97 `!important`, one importer: `SlideCanvas.svelte`); 2,265 lines of module CSS inside Svelte `<style>` blocks (27 `!important`) |
| Mutation semantics | 3 | Client `apps/web/src/lib/utils/mutations.ts` (1,202 lines: `applyMutation` with 18 cases plus `applyMutationSilent` with 13 near-duplicate cases); 14 REST endpoints in `apps/api/src/routes/decks.ts` (915 lines); `apps/api/src/routes/plan.ts` `plan/apply` re-implements bulk slide insertion |
| Mutation vocabulary | 3 | `packages/shared/src/mutations.ts` lists 15 actions; the client switch handles 18 (`updateBlockStep`, `updateTheme`, `updateDeckMeta` are not in the type); `apps/api/src/prompts/system.ts` documents its own list in prose |
| Mutation fence parsing | 2, and they differ | Client `extractMutations` uses ``/```mutation\s*\n/`` (case-sensitive, no space allowed); server `chat.ts:415` uses ``/```\s*mutation\s*\n/gi``. A model that emits `` ``` mutation `` is persisted to `chat_messages.mutations` but never applied on the canvas |
| Artifact source resolution | 5 | `mutations.ts resolveArtifactSource`; `ArtifactModule.svelte`; `decks.ts normalizeBlockData`; `apps/api/src/utils/resolve-artifacts.ts` (preview + export); `apps/web/src/lib/utils/artifact-config.ts buildSourceWithConfig`, which duplicates `applyFactoryToSource` in `packages/shared/src/artifact-registry.ts` |
| Native artifact factories | 2, hand-ported | TypeScript in `apps/web/src/lib/modules/artifacts/` (13 files, ~3,200 lines); a vanilla-JS string of the same 13 factories in `apps/api/src/export/artifacts.ts` (2,656 lines). A fix in one does not reach the other |
| Theme → CSS variables | 5 | `apps/api/src/db/seed.ts generateThemeCss`, `routes/resources.ts` POST and PATCH (all three write `--slide-*` variables that no renderer reads); `html-renderer.ts renderDeckHtml` (computes `--theme-*` with a luminance rule); `SlideCanvas.svelte themeStyle` (the same luminance rule again); `framework-preview.css` aliases `--accent-*` to `--theme-*` |
| Markdown → HTML | 4 | `packages/shared/src/rich-text.ts markdownToHtml`; a private `markdownToHtml` + `inlineMd` inside `html-renderer.ts` (used by `card-grid` and `stream-list`); `apps/web/src/lib/utils/markdown.ts`; `ChatMessage.svelte renderContent` |
| Load a deck with its blocks | 5 | The slides query + blocks query + `blocksBySlide` grouping is copied in `decks.ts`, `chat.ts`, `preview.ts` (twice), `export.ts`, and `plan.ts` |

### 1.2 The cost shows up in the history

Most-changed files across the repository's 64 commits (April to August 2026):

| Changes | File |
|---|---|
| 13 | `apps/api/src/export/html-renderer.ts` |
| 11 | `apps/web/src/lib/utils/mutations.ts` |
| 10 | `apps/web/src/lib/framework-preview.css` |
| 9 | `apps/web/src/lib/utils/slide-html.ts` (dead) |
| 9 | `apps/api/src/prompts/system.ts` |
| 8 | `apps/web/src/lib/components/canvas/SlideRenderer.svelte` |
| 4–7 each | eleven `*Module.svelte` renderers |

Every file in that list is one side of a parity pair. The churn is the tax of keeping copies aligned, not feature work.

### 1.3 Structural consequences

- **Compound edits are not atomic.** `applyTemplate` runs as N `DELETE` + one `PATCH` + N `POST` requests from the browser (`mutations.ts:624-680`). A failure mid-sequence leaves a half-applied slide, and its undo is a coarse whole-slide restore (`_restoreSlide`). `CLAUDE.md` documents the resulting snapshot-corruption bug and the "409 without rollback" gap as known issues.
- **The AI's edit path is the longest path in the system.** Model text → SSE text → client regex → client switch → one to N `fetch` calls → server transaction → response → store. The server persists mutations it never validated or applied, and the `StreamEvent` type in shared already declares a `{ type: 'mutation' }` event that nothing emits.
- **The largest surfaces have no unit coverage.** There are 695 vitest tests, but vitest cannot import `$lib` (documented in `CLAUDE.md`), so the 4,519-line render surface and the 1,202-line mutation orchestrator are covered only by 15 Playwright specs, and those do not run in CI (`.github/workflows/ci.yml` runs build + vitest + shell scripts).
- **Two runtimes for a client-rendered app.** Every page loads its data in `onMount`; `hooks.server.ts` only sets headers; the only two `+server.ts` routes are same-origin proxies of API endpoints (`/thumbnail/:id` → `/api/decks/:id/thumbnail`, `/artifact?b64=` → `/api/artifact?b64=`). Running SvelteKit's Node server beside Hono is what forced the client-side-only admin guard, the `${base}/` prefix discipline, and the Vite proxy shim that injects an `Origin` header for CSRF.
- **Token accounting is an estimate.** `token_usage` records `chars / 4`; every provider returns real usage in its stream and it is discarded.

---

## 2. Target architecture: one model, three hosts

```
packages/
  core/        deck document schema (zod) · mutation reducer + inverses · validation
               · theme → CSS variables · artifact block resolution · markdown · dnd transforms
  render/      Svelte 5 view components (no edit state) · framework.css · deck-engine.js
               · SSR entry: renderDeckHtml(doc) via render() from svelte/server
  artifacts/   13 native factories as TypeScript · one Vite build → ESM (editor) + IIFE (export/preview)
               · registry + config schemas (NATIVE_ARTIFACT_NAMES derived, not typed by hand)
  ai/          provider adapters → ModelEvent stream · tool schema derived from core's Mutation type
               · prompt builder (static half generated from the registry, dynamic half from the document)

apps/
  api/         Hono: auth · POST /api/decks/:id/mutations · chat + planner loop · files/search/sharing
               · export + publish via generateDeckFiles() · serves the built SPA and sets CSP headers
  web/         SvelteKit with adapter-static: editor chrome wrapped around render/ components
               · optimistic dispatch through core's reducer · SSE client · undo/redo from inverses
```

Three hosts (editor, API, exported deck) consume one implementation of each concern. Nothing about the deck is defined in `apps/`.

### 2.1 Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Deck storage | One JSON document per deck (`decks.document`, `decks.version`) plus an append-only `deck_mutations` log | Keep normalized `slides` + `content_blocks` tables | No consumer queries blocks outside deck CRUD (admin stats count decks and tokens; sharing touches neither table). A document makes compound edits atomic, removes `order` integer maintenance and the raw-SQLite transaction workarounds, and makes the AI's "deck state" the literal stored value |
| Write path | Single `POST /api/decks/:id/mutations` (versioned batch) | 14 REST endpoints | One reducer, one validator, one lock check, one log, one place to enforce `MAX_SLIDES_PER_DECK` |
| Undo/redo | Inverses generated by the reducer, identical on server and client | Hand-written reverse mutations in the client | Covers every action by construction; enables per-AI-message undo and correct rollback after 409 |
| Renderer | The Svelte 5 view components render the canvas in the browser and the export HTML on the API via `render()` from `svelte/server` | A framework-neutral string renderer used by both | Components already exist and Svelte 5.55 is pinned; SSR output is unit-testable in vitest; edit chrome composes around pure views |
| CSS | One `framework.css` using container-query units, consumed by canvas, preview, and export | Keep BASE/EXPORT/PREVIEW strings plus the preview override sheet | `framework-preview.css` exists only to re-mirror BASE with `!important`; one stylesheet removes the bug class the parity agents were written for |
| Theme | `computeThemeVars(theme)` pure function in core | Per-surface generation | One luminance rule; the `themes.css` column becomes derived (or is dropped) |
| Artifacts | One TypeScript source, dual Vite build (ESM + IIFE) | Hand-maintained JavaScript port | 2,656 lines of duplicated code deleted; a factory fix ships to editor, preview, and export at once |
| AI output | Provider tool use with a JSON schema generated from the `Mutation` zod type; the fenced-JSON parser stays as a fallback for models flagged without tool support | Fenced blocks parsed by regex on both ends | Schema-validated input, no dual regex, real usage numbers, server-side application |
| AI application | The server applies tool calls through the reducer and streams `{ type: 'mutation', version, mutation, inverse }`; risky actions go through `mode: 'propose'` on the same endpoint | Client applies from streamed text | Shortest path; the existing accept/reject UI is preserved as propose/commit |
| Hosting | `adapter-static` SPA served by Hono, one process | Two processes behind Nginx prefix routing | `adapter-static` is already a devDependency; the two `+server.ts` routes are proxies of API endpoints; removes the base-path and Origin shims and halves the PM2/Nginx surface |

### 2.2 The document and the reducer (`@slide-maker/core`)

```ts
// packages/core/src/document.ts
export const Block = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('heading'), zone: Zone, stepOrder: z.number().nullable(), data: HeadingData }),
  z.object({ id, type: z.literal('text'),    zone: Zone, stepOrder, data: TextData }),
  // … one entry per module type; ModuleDataMap from block-types.ts becomes these schemas
])
export const Slide = z.object({
  id: z.string(), layout: z.enum(LAYOUTS), splitRatio: z.number().min(0.2).max(0.8),
  title: z.string().nullable(), notes: z.string().nullable(),
  blocks: z.array(Block),            // zone + array position define layout; no `order` column
  meta: z.object({ sourceNodeIds: z.array(z.string()).optional() }).optional(),
})
export const DeckDocument = z.object({
  id, name, slug, themeId: z.string().nullable(), metadata: DeckMetadata,
  version: z.number().int(),         // bumped once per committed batch
  slides: z.array(Slide),
})
```

```ts
// packages/core/src/reducer.ts
export type ApplyResult =
  | { ok: true; doc: DeckDocument; inverse: Mutation; touched: BlockRef[] }
  | { ok: false; error: ValidationError }

export function applyMutation(doc: DeckDocument, m: Mutation, ctx: ReducerContext): ApplyResult
export function applyBatch(doc: DeckDocument, ms: Mutation[], ctx: ReducerContext):
  { ok: true; doc: DeckDocument; inverses: Mutation[] } | { ok: false; error: ValidationError; at: number }
```

- `ReducerContext` carries the artifact registry and the template list, so `addBlock` of an artifact resolves its source once, here, and `applyTemplate` expands to concrete blocks here. No request fan-out.
- The invariant `applyMutation(applyMutation(doc, m).doc, inverse).doc` deep-equals `doc` holds for every action and is enforced by a property test. That invariant is the undo guarantee.
- `dnd-transforms.ts`, `slide-layout.ts`, `validation.ts`, `rich-text.ts`, and `artifact-registry.ts` move from `packages/shared` into core unchanged. `packages/shared` is retired; `core` is the shared package.

**Persistence**

```
decks           (id, name, slug, theme_id, metadata JSON, document JSON, version INT, created_by, created_at, updated_at)
deck_mutations  (id, deck_id, version, actor_kind ENUM(user|ai|plan|system), actor_id, message_id NULL,
                 mutation JSON, inverse JSON, created_at)
```

- `slides` and `content_blocks` are read once by the migration and then dropped.
- `POST /api/decks/:id/mutations` body: `{ baseVersion, mutations: Mutation[], mode: 'commit' | 'propose' }`. Responses: `200 { version, inverses }`, `409 { conflict: 'version' | 'lock', current }`, `422 { error, at }`. The deck lock check (`checkDeckLock`) runs once, here.
- The client `deck` store holds the document. UI code calls `dispatch(mutations)`, which applies optimistically with the same reducer and posts the batch. On `409 version` it re-fetches and re-applies; on `409 lock` or `422` it applies the inverses locally. The "no rollback after 409" gap closes by construction.
- Undo/redo is a stack of `{ mutations, inverses }` batches; undo dispatches the inverses as an ordinary batch, so it is logged like any edit. Per-AI-message undo is the inverses of the log rows sharing a `message_id`.
- Presence and locking are unchanged. Real-time collaboration is out of scope, but broadcasting committed log rows over SSE is the obvious next step and needs no new data model.

### 2.3 One renderer (`@slide-maker/render`)

- `packages/render/src/modules/Card.svelte`, `Heading.svelte`, … take `{ block, surface: 'canvas' | 'export' }` and hold no state: no `$state`, no TipTap, no `fetch`. They emit the markup `html-renderer.ts` emits today, class for class, so `framework.css` and `deck-engine.js` keep working.
- `SlideView.svelte` and `DeckView.svelte` use `getSlideSections()` from core, so zone logic is shared instead of re-derived in `SlideRenderer.svelte`.
- `packages/render/src/server.ts` exports `renderDeckHtml(doc, theme, opts)` which calls `render(DeckView, { props })` from `svelte/server` and wraps the result in the document shell (fonts, nav bar, engine scripts). The API imports the built entry `@slide-maker/render/server`; Turbo's `dependsOn: ["^build"]` already orders the build.
- Editing lives in `apps/web`: `EditableBlock.svelte` wraps a view component with the drag handle, resize handles, step selector, delete button, and swaps in `RichTextEditor` on activation. This is what `ModuleRenderer.svelte` already does around `Renderer`; the change is moving editor state out of leaf components such as `CardModule.svelte` (which currently owns `editorActive`, `editContent`, and `clickCoords`).
- CSS becomes three files with distinct owners: `packages/render/src/framework.css` (layouts, modules, one `--theme-*` vocabulary, `cqi` units), `packages/render/src/deck-engine.css` (nav bar, step reveal, overview, print; export only), and `apps/web/src/lib/canvas.css` (edit chrome only). `framework-preview.css`, the BASE/EXPORT/PREVIEW string exports, and the module CSS inside Svelte `<style>` blocks are deleted.
- `computeThemeVars(theme)` from core is applied as an inline style on `.slide-frame` in the canvas and as a `:root {}` block in SSR. The five theme generators collapse to one.
- Step reveals: the renderer always emits `data-step`; the canvas badge and the preview's always-visible behavior are `[data-surface]` CSS rules, not renderer branches.

### 2.4 One artifact runtime (`@slide-maker/artifacts`)

- Each factory file exports `{ id, name, description, schema, create }`. `index.ts` builds the registry; `NATIVE_ARTIFACT_NAMES` is `Object.keys(registry)`.
- One Vite library build produces `dist/index.js` (ESM, imported by the editor) and `dist/artifacts.iife.js` (exposes `SlideArtifacts.register`, copied into the export zip as `js/artifacts.js` and inlined into preview). The same compiled code runs on every surface.
- Seeding: catalog rows for native artifacts are generated from the registry. `templates/artifacts/*.json` keeps only HTML/iframe artifacts (`frappe-*`, `tenprint`, `leaflet-markers`).
- `resolveArtifactBlock(block, registry)` in core is called by the reducer when an `addBlock` or `updateBlock` touches an artifact. The five current resolution sites collapse to that one call.

### 2.5 AI as a client of the same engine (`@slide-maker/ai`)

- Provider adapters return `AsyncIterable<ModelEvent>` where `ModelEvent = text_delta | tool_call { name, input } | usage { input, output, cacheRead } | done | error`. Anthropic uses `messages.stream` with `tools` and keeps `cache_control` on the static system block; OpenRouter uses chat completions with `tools`; Bedrock uses Converse `toolConfig`. Models flagged `tools: false` in the model list get the legacy fenced parser, implemented once in core.
- The tool is `apply_mutations({ mutations: Mutation[] })`. Its JSON schema is generated from the zod `Mutation` type. The mutation and module reference in the system prompt is generated from the same schemas and from the module registry, so the prompt cannot drift from the code and `module-type-parity.test.ts` becomes unnecessary.
- The chat loop on the server: `tool_call` → `applyBatch` (or propose) → persist + log with `message_id` → SSE `{ type: 'mutation', version, mutation, inverse, status: 'applied' | 'proposed' }` → the client applies to its document with no fetch. Text deltas stream as they do today. The planner (`plan.ts`, `prompts/planner.ts`, `strict-planner.ts`) runs the same loop with a planner system prompt; `plan/apply` becomes an ordinary batch commit.
- Token usage comes from provider `usage` events; the `chars / 4` estimate remains only as a fallback.
- `serializeDeck(doc, { activeSlideId, expandSlideIds })` reads the document directly for the dynamic prompt half. The static/dynamic split and Anthropic prompt caching are preserved exactly as `CLAUDE.md` describes them.

### 2.6 One process

- `apps/web` switches to `@sveltejs/adapter-static` with an `index.html` fallback. Hono serves `apps/web/build` with `serveStatic` and applies the CSP headers from `hooks.server.ts`. The two `+server.ts` proxies are deleted; `DeckCard.svelte` points at `/api/decks/:id/thumbnail` directly.
- `PUBLIC_URL` base-path handling becomes one config value in one place. PM2 runs one process; Nginx proxies one upstream; the Vite dev proxy no longer needs to forge an `Origin` header.
- Export and Kale publish share `generateDeckFiles(doc, theme, files): GeneratedFile[]` (the shared core proposed in `2026-04-11-kale-deploy-integration-design.md`), backed by `render/server` and the artifacts IIFE.

---

## 3. Migration plan

Each phase leaves `main` deployable and can be the stopping point. Sizes are relative (S/M/L), not calendar estimates.

### Phase 0 — Guardrails (S)
- Capture golden export HTML for three fixture decks covering all 7 layouts, all 14 modules, and a dark and a light theme, into `tests/fixtures/golden/`. Add a test that renders the fixtures and diffs. Every later phase keeps this green or updates it deliberately.
- Unify the two fence regexes into one exported parser (an immediate bug fix).
- Delete dead code: `slide-html.ts`, `framework-css-client.ts`, the one-line `apps/api/src/export/framework-css.ts` re-export, and the stale catalog table in `templates/artifacts/README.md` (it lists artifacts that do not exist).

### Phase 1 — Core reducer beside the old endpoints (M)
- Create `packages/core`: zod schemas, reducer, inverses, `computeThemeVars`, `resolveArtifactBlock`, property tests.
- Add `POST /api/decks/:id/mutations`. It assembles the document from the tables, applies the reducer, and dual-writes: the new `document` column and the legacy rows, so the old endpoints keep working during the transition.
- Client: `dispatch()` replaces `applyMutation` and `applyMutationSilent`; `history.ts` becomes a batch stack. The components that call `apiCall` or `fetch` directly (`SlideRenderer`, `SlideCard`, `BlockItem`, `AddSlideMenu`, `ModulePicker`, `CanvasToolbar`, `TemplatesTab`) switch to `dispatch`.

### Phase 2 — Document cutover (M)
- Migration script builds `decks.document` from `slides` + `content_blocks` and writes one `system:import` row per deck into `deck_mutations`.
- `GET /api/decks/:id` returns the document. Chat, preview, export, and plan read the document.
- Delete the 14 slide/block endpoints, `plan/apply`, the five join copies, `normalizeBlockData`, and `resolve-artifacts.ts`. Drop the two tables.

### Phase 3 — Render package (L)
- Move view markup into pure components; add the SSR entry; switch export, preview, and thumbnail to it. The Phase 0 golden test must pass class for class.
- Wrap views with `EditableBlock` in the canvas. Delete `framework-preview.css`, per-module CSS in `<style>` blocks, and the module switch in `html-renderer.ts`.
- Retire or repoint the `css-parity` and `rendering-parity` agents; their audit surface is now one package.

### Phase 4 — Artifacts package (M)
- Move the 13 factories, add the dual build, seed from the registry, delete `apps/api/src/export/artifacts.ts`.

### Phase 5 — AI package (M)
- `ModelEvent` adapters, generated tool schema, server-side application with propose/commit, planner on the same loop.
- Delete `pending-mutations.ts` (proposed rows replace it), both fence regexes (fallback parser stays in core), and the `chars / 4` accounting except as a fallback.

### Phase 6 — Single host (S)
- `adapter-static`, Hono static serving, one PM2 process, Nginx simplification, `generateDeckFiles` wired for Kale publish.

---

## 4. What gets deleted, what gets added

Line counts are current; replacements are estimates.

| Deleted or shrunk | Lines today | Replacement | Estimated lines |
|---|---|---|---|
| `apps/api/src/export/artifacts.ts` (JS port) | 2,656 | Vite IIFE build of `packages/artifacts` | 0 hand-written |
| Module CSS inside Svelte `<style>` blocks | 2,265 | `framework.css` (shared) + `canvas.css` (edit chrome) | ~900 total |
| `apps/web/src/lib/utils/mutations.ts` | 1,202 | `dispatch()` + core reducer | ~350 (client) + ~600 (core) |
| `apps/api/src/routes/decks.ts` slide/block endpoints | ~650 of 915 | `POST /mutations` handler | ~120 |
| `apps/api/src/export/html-renderer.ts` module switch | ~420 of 600 | `render/server.ts` shell around `render()` | ~120 |
| `apps/web/src/lib/utils/slide-html.ts` (dead) | 378 | none | 0 |
| `apps/web/src/lib/framework-preview.css` | 252 | none | 0 |
| `plan/apply` bulk insert in `plan.ts` | ~120 | ordinary batch commit | 0 |
| Five deck-loading joins | ~200 | `loadDeck(id)` | ~20 |
| Five theme generators | ~150 | `computeThemeVars` | ~40 |

Net effect: roughly six to seven thousand lines removed, about two thousand added, and every remaining line has one owner.

---

## 5. Testing that follows the architecture

- **Core:** property tests for the apply/inverse identity on every action; golden tests per mutation; schema tests that reject phantom module types (the current `module-type-parity` cases move here).
- **Render:** vitest with `@sveltejs/vite-plugin-svelte` inside the package (no `$lib` alias, so the current blocker disappears). Snapshot `render()` output per module, per layout, per theme mode. One test asserts that hydrating the SSR HTML in the canvas produces the same DOM, which makes edit/view/preview/export parity a test rather than an audit.
- **Artifacts:** each factory constructed in happy-dom and asserted to draw; the IIFE loaded in a Playwright page against the exported HTML.
- **AI:** contract tests that the generated tool schema accepts every few-shot example in the prompt; adapters tested against recorded provider streams.
- **Shell scripts:** `tests/test_structure.sh`, `test_export_pipeline.sh`, `test_module_registry.sh`, and `test_shared_types.sh` assert file paths and string patterns; each phase updates them, and most retire in favor of typecheck plus the tests above. `loopback-binding.test.ts` stays.
- **CI:** add the Playwright suite to `ci.yml` once the golden tests exist, so canvas behavior is gated as well as build output.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Svelte SSR consumed from a `tsc`-built API | The API imports a prebuilt package entry; one workspace pins one Svelte version; the golden test runs in CI after the render build |
| Whole-document writes and log growth | Decks are capped at 60 slides, so documents are tens of kilobytes; compact `deck_mutations` past N rows per deck on export or by a scheduled job |
| Loss of row-level checks on blocks | The reducer rejects unknown ids and invalid zones; access checks are already deck-level (`deck_access`) |
| Tool-use fidelity on OpenRouter models | Per-model `tools` flag with the fenced fallback; measure with the existing `/api/debug/transcripts` log before removing the fallback for a model |
| TipTap and drag-and-drop inside wrapped components | `ModuleRenderer.svelte` already wraps a leaf renderer with chrome; the wrapper contract (`block`, `surface`, `onchange`) is fixed in Phase 1 and the leaf components are ported to it in Phase 3 |
| Refactor scope | Phases 1 and 2 carry most of the value (atomic edits, correct undo, one write path) and are a valid stopping point |
| Shell tests encode the current file layout | Update per phase; they are grep-based, not behavioral, so updates are mechanical |

---

## 7. Explicitly unchanged

Auth (Lucia, CUNY domain gating, verification and approval flows), admin dashboard, sharing, locking and presence, uploads and search with SSRF guards, email, rate limiting, the CSP and security invariants listed in `CLAUDE.md`, the 7 layouts and 14 module types, the zone model, and the export zip layout (`index.html`, `css/styles.css`, `js/engine.js`, `js/artifacts.js`, `assets/`, `artifacts/`).

---

## 8. Relationship to `docs/TODO.md`

Several open items resolve as a by-product rather than as separate work:

- "Undo / Redo Hardening: ensure reverse mutations exist for all actions" — reducer inverses cover every action (Phase 1).
- "Group/coalesce rapid mutations into a single history entry" — batches are the unit of history (Phase 1).
- "Expand mutations exposed to the assistant so every module's key–value pairs are reachable" — the tool schema is generated from the block schemas (Phase 5).
- "System prompt: list features + examples as key–value JSON mutations" — generated from the same schemas (Phase 5).
- "View mode WYSIWYG: render view mode via iframe srcdoc using a new client-side renderer mirroring html-renderer.ts" — superseded; one renderer serves both (Phase 3).
- "Integration test: unzip export and assert artifact files" — covered by the golden export test (Phase 0) and the artifacts IIFE test (Phase 4).

---

## 9. Alternatives considered and rejected

- **Keep the normalized tables and add only the mutations endpoint.** Removes the request fan-out but keeps five deck loaders, `order` maintenance, and per-row artifact normalization. It is the fallback if the document migration is judged too risky; Phase 1 works either way.
- **A framework-neutral string renderer for both surfaces.** Simpler build, but the canvas would render through `{@html}` and the edit wrapper would have to re-discover DOM to attach chrome; reactivity per block is lost.
- **Rewriting on a different stack.** No leverage. The problem is duplication across surfaces, not the choice of Svelte, Hono, or SQLite.
