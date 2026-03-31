# Frontend Optimization & Export Pipeline Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the export pipeline for artifact-heavy decks, clean up dead code from the iframe→native renderer migration, and close the agentic integration gap for artifact modules.

**Architecture:** The prior instance successfully migrated view mode from iframe srcdoc to native SlideRenderer. This plan addresses the remaining rough edges: orphaned code (done), container query consistency (done), export artifact bloat (inlined srcdoc → separate files), and system prompt awareness of available artifacts.

**Tech Stack:** SvelteKit 2, Svelte 5, Hono, archiver (ZIP), Vitest

---

## Audit Summary (Completed)

These items were verified and resolved before writing this plan:

| Item | Status | Action Taken |
|------|--------|-------------|
| View mode renders via SlideRenderer | Pass | No action needed |
| Click-overlay + edit-hint hover | Pass | No action needed |
| Container query chain unbroken | Pass | No competing `container-type` declarations |
| All 12 artifact JSONs parse | Pass | Validated via node script |
| All 34 unit tests pass | Pass | No regressions |
| Playwright config package names | Pass | Match `@slide-maker/api` and `@slide-maker/web` |
| CSP meta tag in artifact blob URLs | Pass | Injected in `ArtifactModule.svelte` |
| rendererMap is module-level const | Pass | Not recreated per render |
| CarouselModule `max-height: 55vh` | Fixed | Changed to `55cqi` for container consistency |
| Orphaned `slide-html.ts` (430 lines) | Removed | Dead code from iframe era |
| Orphaned `framework-css-client.ts` | Removed | Re-export only used by slide-html.ts |
| Svelte 4 stores vs Svelte 5 runes | Assessed | All stores use `writable()` — intentional, works fine in Svelte 5 |
| ComparisonModule container breakpoint | Pass | `@container (max-width: 500px)` correct |
| No remaining `vw` units in renderers | Pass | All converted to `cqi` |

### File Map

```
Modified:
  apps/api/src/export/index.ts              — add artifact file extraction to ZIP
  apps/api/src/export/html-renderer.ts       — reference external artifact files instead of inlining srcdoc
  apps/api/src/prompts/system.ts             — include available artifacts in system prompt context
  tests/framework-css.test.ts                — add artifact export tests

Already done (this session):
  apps/web/src/lib/components/renderers/CarouselModule.svelte  — vh→cqi fix
  (deleted) apps/web/src/lib/utils/slide-html.ts               — dead code
  (deleted) apps/web/src/lib/utils/framework-css-client.ts      — dead code
```

---

### Task 1: Extract artifacts to separate files in export ZIP

Currently, artifact `rawSource` (3-15KB each, HTML-escaped) is inlined as `srcdoc` attributes in the single `index.html`. For decks with 5+ artifacts, this bloats the HTML and breaks cacheability. Extract each artifact to its own file in `artifacts/` within the ZIP.

**Files:**
- Modify: `apps/api/src/export/html-renderer.ts:257-269`
- Modify: `apps/api/src/export/index.ts:48-79`
- Test: `tests/export-artifacts.test.ts` (new)

- [ ] **Step 1: Write failing test for artifact file extraction**

```typescript
// tests/export-artifacts.test.ts
import { describe, it, expect } from 'vitest'

describe('export artifact extraction', () => {
  it('should generate iframe src pointing to artifacts/ directory for rawSource modules', () => {
    // We test the renderModule function's output for artifact type
    // When rawSource is present, it should reference an external file
    const mod = {
      type: 'artifact',
      zone: 'main',
      data: { rawSource: '<html><body>test</body></html>', alt: 'Test viz' },
      order: 0,
    }
    // Import will be added after implementation
    const { renderModule } = require('../apps/api/src/export/html-renderer')
    const html = renderModule(mod, [], { extractArtifacts: true })
    expect(html).toContain('src="artifacts/')
    expect(html).not.toContain('srcdoc=')
  })

  it('should still inline srcdoc when extractArtifacts is false', () => {
    const mod = {
      type: 'artifact',
      zone: 'main',
      data: { rawSource: '<html><body>test</body></html>', alt: 'Test viz' },
      order: 0,
    }
    const { renderModule } = require('../apps/api/src/export/html-renderer')
    const html = renderModule(mod)
    expect(html).toContain('srcdoc=')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-artifacts.test.ts`
Expected: FAIL — `renderModule` is not exported / doesn't accept options

- [ ] **Step 3: Update html-renderer to support artifact extraction**

In `apps/api/src/export/html-renderer.ts`, modify the artifact case in `renderModule`:

```typescript
// Add options parameter to renderModule
interface RenderOptions {
  extractArtifacts?: boolean
}

// Track extracted artifacts for the ZIP
const extractedArtifacts: Map<string, string> = new Map()

export function getExtractedArtifacts(): Map<string, string> {
  return new Map(extractedArtifacts)
}

export function clearExtractedArtifacts(): void {
  extractedArtifacts.clear()
}

// In renderModule, update the artifact case:
case 'artifact': {
  const rawSrc = String(d.src || d.url || '')
  const rawSource = d.rawSource ? String(d.rawSource) : ''
  const isUrl = /^https?:\/\//i.test(rawSrc)
  const alt = esc(String(d.alt || 'Interactive visualization'))
  if (isUrl) {
    return `<div class="artifact-wrapper"${step}><iframe src="${esc(rawSrc)}" sandbox="allow-scripts" loading="lazy" title="${alt}"></iframe></div>`
  }
  if (rawSource && opts?.extractArtifacts) {
    const hash = Buffer.from(rawSource).toString('base64url').slice(0, 12)
    const filename = `artifact-${hash}.html`
    extractedArtifacts.set(filename, rawSource)
    return `<div class="artifact-wrapper"${step}><iframe src="artifacts/${filename}" sandbox="allow-scripts" loading="lazy" title="${alt}"></iframe></div>`
  }
  if (rawSource) {
    return `<div class="artifact-wrapper"${step}><iframe srcdoc="${esc(rawSource)}" sandbox="allow-scripts" loading="lazy" title="${alt}"></iframe></div>`
  }
  return `<div class="artifact-wrapper"${step} style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">${alt}</div>`
}
```

- [ ] **Step 4: Update export/index.ts to include artifact files in ZIP**

In `apps/api/src/export/index.ts`:

```typescript
import { renderDeckHtml, getExtractedArtifacts, clearExtractedArtifacts } from './html-renderer.js'

// Inside exportDeckAsZip, after renderDeckHtml call:
clearExtractedArtifacts() // reset before render
const html = renderDeckHtml(deckName, normalized, theme, files, { extractArtifacts: true })
const artifacts = getExtractedArtifacts()

// After archive.append(manifest, ...) add:
for (const [filename, source] of artifacts) {
  archive.append(source, { name: `${slug}/artifacts/${filename}` })
}
```

- [ ] **Step 5: Export renderModule for testing**

Add to the bottom of `html-renderer.ts`:
```typescript
export { renderModule }
```

- [ ] **Step 6: Run tests and verify pass**

Run: `npx vitest run tests/export-artifacts.test.ts`
Expected: PASS

- [ ] **Step 7: Run all tests to check for regressions**

Run: `npx vitest run`
Expected: All 34+ tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/export/html-renderer.ts apps/api/src/export/index.ts tests/export-artifacts.test.ts
git commit -m "feat: extract artifacts to separate files in export zip"
```

---

### Task 2: Add available artifacts to AI system prompt

The system prompt includes templates, theme, and uploaded files — but not available artifacts. When users say "add a visualization" the AI has no context about what artifacts exist. Adding artifact awareness lets the AI suggest and insert specific visualizations.

**Files:**
- Modify: `apps/api/src/prompts/system.ts:38-41,256-258`
- Modify: `apps/api/src/routes/chat.ts` (where buildSystemPrompt is called — pass artifacts)

- [ ] **Step 1: Add artifacts to BuildPromptOptions interface**

In `apps/api/src/prompts/system.ts`:

```typescript
interface BuildPromptOptions {
  deck: DeckState
  activeSlideId: string | null
  templates?: { id: string; name: string; layout: string; modules: unknown[] }[]
  theme?: { id: string; name: string; colors: unknown; fonts: unknown } | null
  files?: UploadedFile[]
  artifacts?: { id: string; name: string; description: string; type: string }[]
}
```

- [ ] **Step 2: Add artifact list to the system prompt output**

After the `## Uploaded Files` section in the prompt template string, add:

```typescript
const artifactsList = opts.artifacts?.length
  ? opts.artifacts.map((a) => `  - "${a.name}" (id="${a.id}", type="${a.type}"): ${a.description}`).join('\n')
  : '(none available)'

// Add to the prompt string:
## Available Artifacts (Interactive Visualizations)
${artifactsList}

When a user wants an interactive visualization, use the artifact module type with the artifact's source.
To insert an artifact, use: { "type": "artifact", "zone": "<zone>", "data": { "src": "/api/artifacts/<id>/source", "alt": "<name>" } }
```

- [ ] **Step 3: Pass artifacts from chat route**

Find where `buildSystemPrompt` is called in the chat route and add the artifacts query:

```typescript
// Query artifacts from DB
const artifactRows = db.select({
  id: artifacts.id,
  name: artifacts.name,
  description: artifacts.description,
  type: artifacts.type,
}).from(artifacts).all()

// Pass to buildSystemPrompt
const systemPrompt = buildSystemPrompt({
  ...existingOptions,
  artifacts: artifactRows,
})
```

- [ ] **Step 4: Verify by reading the generated prompt**

Start dev server, open a deck, send a chat message. Check server logs or network tab for the system prompt content. Verify artifacts appear in the prompt.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/prompts/system.ts apps/api/src/routes/chat.ts
git commit -m "feat: include available artifacts in ai system prompt context"
```

---

### Task 3: Write roadmap summary document

**Files:**
- Create: `docs/roadmap-frontend-optimization.md`

- [ ] **Step 1: Write the roadmap doc**

Document the audit findings, completed fixes, and remaining work items from this plan. Include the prior instance assessment: their library recommendations (Moveable, PaneForge, Melt UI, Floating UI, Endo, Unovis) are premature — the project needs stability and export pipeline hardening before adding new UI framework dependencies.

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap-frontend-optimization.md
git commit -m "docs: add frontend optimization roadmap and audit results"
```

---

## Not In Scope (Assessed and Deferred)

These items from the handoff document were evaluated and intentionally deferred:

| Item | Reason |
|------|--------|
| Migrate Svelte 4 stores to $state() | Works fine as-is. Svelte 5 supports both patterns. Migration risk > benefit. |
| PaneForge for panel layout | EditorShell's 80-line resize code is straightforward. A dependency adds more complexity than it removes. |
| Melt UI for component system | Current UI is functional. Adding a new component library mid-project creates inconsistency. |
| Moveable for block resize | Current corner-resize works. Moveable adds 50KB+ for marginal gain. |
| Floating UI for popovers | Manual positioning is <20 lines where used. Overkill. |
| Endo for artifact isolation | Iframe sandbox is the correct browser primitive for untrusted HTML. SES is experimental. |
| Unovis for chart artifacts | The 12 Creative Clawing artifacts are self-contained canvas animations. A chart library solves a different problem. |
| Kale Deploy integration | Requires the export pipeline to stabilize first (Task 1). Assess after artifact extraction ships. |
| SlideRenderer splitRatio $effect | Looks like a redundant sync but is actually correct — two-way binding between prop changes and local drag state. |
