# Slide-Maker: Handoff Brief — Audit & Complementary Roadmap

> **For**: New Claude Code instance (independent shell)
> **From**: Prior instance that completed the 7-phase canvas refactor
> **Date**: 2026-03-31
> **Plan reference**: `.claude/plans/snug-herding-parasol.md`

---

## Background

You are picking up work on `slide-maker`, a chat-driven slide builder for the CUNY AI Lab. Another instance just completed a significant refactor across 7 phases. Before doing anything else, **audit their work**, then plan your own complementary roadmap using the checkboxes below.

Linked at the end of this brief is a summary of the other instance's work on a recent revamp of the edit/view features as a UX improvement. Plan a task that will work **independently of — and in complementary relation to** — the roadmap being implemented in the other shell.

Review the frontend and consider it in relation to itself and the backend according to professional agentic software engineering standards. Determine where:

1. It can make more efficient use of **Svelte + Vite**, particularly how Svelte is being used — tying programmatic threads consistently and efficiently into the context window of the agentic system in place
2. It produces structural abilities for the agent to alter features of the interface from **edit mode** in particular, but also view and the full available **resources tab**
3. How the **JS primitives get injected into HTML files** — as part of the export package? Is that simply a single HTML file? How can that instead be wired up to `cuny-ai-lab/cail-deploy` (aka CUNY AI Lab marketplace on Claude Code and the MCP, but mostly the plugins in the marketplace)

Break these concerns into part of this local roadmap — and use it to plan out the next steps in addition to the other instance's progress.

---

## Part 1: Audit the Prior Instance's Work

Each phase below needs verification. Check the box when audited and passing.

### Phase 1+2: Unified View Mode + Framework CSS

- [ ] Verify view mode renders correctly — `.slide-frame.view-mode` class present, `SlideRenderer` with `editable={false}` produces identical output to old iframe
- [ ] Confirm click-overlay and edit-hint hover behavior works (depends on `.slide-frame.view-mode:hover .edit-hint` selector)
- [ ] Check that `handleEditorBlur` (still in SlideCanvas) isn't creating stale editor refs after iframe removal
- [ ] Verify `slide-html.ts` is still imported where needed — API preview route uses server-side renderer, not this client file. Confirm it's not orphaned or that removing its import didn't break anything
- [ ] Confirm `framework-preview.css` `cqi` values render correctly at different canvas widths
- [ ] Test theme switching in both edit and view mode — CSS variables should propagate identically

### Phase 3: Responsive Modules (vw → cqi)

- [ ] Verify container query chain is unbroken: `.slide` (`container-type: inline-size`) → zone divs → module renderers. No intermediate element should create a competing container context
- [ ] Check `CarouselModule.svelte` — still has `max-height: 55vh` on images. Decide: should this be `cqb` or stay viewport-relative?
- [ ] Resize the browser at multiple widths (1440, 1024, 860px) and confirm modules scale smoothly
- [ ] Verify `@container (max-width: 500px)` breakpoint in ComparisonModule triggers correctly

### Phase 4: JS Primitives (Creative Clawing Artifacts)

- [ ] Validate all 12 JSON templates parse correctly: `node -e "for(const f of require('fs').readdirSync('templates/artifacts').filter(f=>f.endsWith('.json'))){JSON.parse(require('fs').readFileSync('templates/artifacts/'+f,'utf8'));console.log('OK:',f)}"`
- [ ] Run `pnpm db:seed` and confirm all 12 artifacts load into the database
- [ ] Load each artifact in the browser via the Artifacts tab → verify canvas renders in iframe
- [ ] Read `JS_SLIDE_MAKER_BLOCKS.md` (copied to project root) — integrate any reference material into planning

### Phase 5: Artifact Security

- [ ] Confirm CSP meta tag appears in blob URL HTML: inspect iframe src in devtools → `URL.createObjectURL` result should contain `<meta http-equiv="Content-Security-Policy" ...>`
- [ ] Verify none of the 12 Creative Clawing sketches need network access (they should all be self-contained canvas animations)
- [ ] Check for `$effect` cleanup race condition: does blob URL revocation fire before the iframe finishes loading? Test by adding a slow-rendering artifact and switching slides rapidly
- [ ] Verify `connect-src 'none'` in artifact CSP doesn't break any sketches that use `fetch()` or `XMLHttpRequest`

### Phase 6: Playwright E2E

- [ ] Verify `playwright.config.ts` webServer commands match actual package names (`@slide-maker/api`, `@slide-maker/web` — check `apps/api/package.json` and `apps/web/package.json`)
- [ ] Confirm `ADMIN_SEED_PASSWORD` is set in `.env` or `.env.development`
- [ ] Verify API routes used by fixtures exist: `POST /api/decks`, `POST /api/decks/:id/slides`, `POST /api/decks/:id/slides/:id/blocks`
- [ ] Run `npx playwright test` with dev server running — document any failures

### Phase 7: Design Polish

- [ ] Verify module controls fade (opacity + translateY) doesn't cause layout shift or interfere with click targets when controls are invisible (`pointer-events: none` when `opacity: 0`)
- [ ] Check resize tooltip (`position: absolute; bottom: -22px`) doesn't clip — module wrapper has `overflow: hidden`
- [ ] Step badge repositioned to left edge — verify it doesn't overlap module content or zone padding

### General

- [ ] `npx vitest run` — all 34 existing unit tests pass
- [ ] `pnpm dev` starts both API + web without errors
- [ ] Create a test deck, add slides with multiple module types, switch edit↔view, verify rendering parity
- [ ] Test the full export flow: create deck → add modules → export ZIP → open HTML → verify rendering

---

## Part 2: Svelte + Vite Efficiency Audit

Review how Svelte 5 is being used across the frontend. Check when investigated, note findings.

### Store Architecture

- [ ] Audit store pattern: project mixes Svelte 4 `writable()` stores (`stores/deck.ts`, `stores/ui.ts`, `stores/themes.ts`, `stores/auth.ts`, `stores/chat.ts`, `stores/history.ts`) with Svelte 5 `$state()` in components. Is this intentional or drift? Should stores migrate to runes?
- [ ] Check for `$effect()` chains that should be `$derived()` — effects that only compute values without side effects
- [ ] Identify components that re-render unnecessarily due to overly broad `$effect` dependencies
- [ ] Review `$derived.by(() => { ... })` usage — ensure return values aren't called as functions in templates (known Svelte 5 gotcha, documented in CLAUDE.md)

### Vite Optimization

- [ ] Review `vite.config.ts` for tree-shaking opportunities
- [ ] Check dependency pre-bundling for heavy libraries: TipTap, DOMPurify, svelte-dnd-action, moveable
- [ ] Evaluate bundle size — are there unused imports or dead code paths after the iframe removal?
- [ ] Check if `framework-css-client.ts` duplicates what `framework-preview.css` now provides

### Component Efficiency

- [ ] `EditorShell.svelte` — panel resize uses raw mousedown/mousemove. Could use Svelte actions or pointer events for cleaner code
- [ ] `ZoneDrop.svelte` — the `knownIds` tracking for animation could be simplified with Svelte 5 reactivity
- [ ] `ModuleRenderer.svelte` — the `rendererMap` is recreated every render. Should be a module-level const
- [ ] `SlideCanvas.svelte` — after iframe removal, is `handleEditorBlur` still needed? Is the `{#key}` pattern still used anywhere?

---

## Part 3: Agentic System Integration

The AI chat system drives the editor. Assess how tightly coupled the frontend structure is to the agent's mutation capabilities.

### System Prompt ↔ Frontend Mapping

- [ ] Read `apps/api/src/prompts/system.ts` — how does the system prompt feed deck state, templates, theme, and file URLs to the AI?
- [ ] Map the mutation types (`addSlide`, `addBlock`, `updateBlock`, `removeBlock`, `setTheme`, etc.) to the Svelte components that handle them. Are there UI operations the user can do that the AI cannot replicate via mutations?
- [ ] Can the AI reliably target modules by zone/type? Does the system prompt include enough context for precise edits?
- [ ] How do edit mode changes propagate back to the system prompt's deck state snapshot? Is there a staleness window?

### Resources Tab ↔ Agent Context

- [ ] Assess whether the resources tab (templates, artifacts, themes, files) could be more tightly integrated with AI context
- [ ] Could dragging a template onto the canvas trigger a mutation directly (bypassing chat)?
- [ ] Could artifact selection in the resources tab auto-populate the AI's knowledge of available visualizations?
- [ ] Is the theme picker's state reflected in the system prompt so the AI knows the current theme?

---

## Part 4: Export Pipeline for JS Primitives

The 12 Creative Clawing artifacts are `rawSource` HTML strings in the DB. Assess the export path.

### Current Export Architecture

- [ ] Read `apps/api/src/export/html-renderer.ts` — how are artifacts rendered in export? (Currently: `<iframe srcdoc="...">` with escaped HTML)
- [ ] Read `apps/api/src/export/index.ts` — what's in the ZIP? (`index.html`, `css/styles.css`, `assets/`)
- [ ] Calculate bloat: 12 artifacts at 5-15KB each, fully escaped as srcdoc attributes. Is this acceptable?

### Alternative Approaches

- [ ] Evaluate: should JS primitives be separate `.html` files in the ZIP (referenced by `<iframe src="artifacts/langton.html">`) instead of inlined srcdoc?
- [ ] Evaluate: for Kale Deploy (Cloudflare Workers), is a single HTML file simpler or do separate assets cache better?
- [ ] Evaluate: could a shared CDN at `creative-clawing.com` serve artifacts instead of bundling per-deck? (Already in CSP whitelist)

---

## Part 5: CAIL-Deploy / Marketplace Integration

- [ ] Read available `kale-deploy` skills — how would exported decks deploy as standalone sites?
- [ ] Assess plugin architecture: could the artifact system become a plugin (`cuny-ai-lab/slide-maker-artifacts`) consumed by other CUNY tools?
- [ ] Consider: if decks deploy via Kale to Cloudflare Workers, what's the handoff format? Single HTML? Multi-file bundle?
- [ ] Consider: how does the presentation navigation JS (step reveals, carousel sync, keyboard nav) work in a deployed context vs the editor preview?

---

## Part 6: Roadmap Prioritization

After completing the audit and investigation above, create your implementation plan. Prioritize by:

1. **Unblocks the most value** — what enables other work?
2. **Fixes regressions** — anything the prior instance broke
3. **Efficiency gains** — Svelte/Vite optimizations that reduce complexity
4. **Integration** — connecting export pipeline to deploy pipeline

Write your plan to `docs/roadmap-frontend-optimization.md` and begin implementation of the highest-priority items.

---

## Files to Read First

- `CLAUDE.md` — project conventions and architecture
- `.claude/plans/snug-herding-parasol.md` — the completed 7-phase plan
- `JS_SLIDE_MAKER_BLOCKS.md` — JS primitives reference (project root)
- `apps/web/src/lib/components/canvas/SlideCanvas.svelte` — the central canvas file (recently modified)
- `apps/web/src/lib/components/renderers/ArtifactModule.svelte` — artifact rendering (recently modified)
- `apps/api/src/export/index.ts` + `html-renderer.ts` — export pipeline
- `apps/api/src/prompts/system.ts` — AI system prompt

## Skills to Use

- `feature-dev` for architecture decisions
- `code-review` after significant changes
- `superpowers:verification-before-completion` before claiming anything is done
- `kale-deploy` skills when working on deploy integration
