# Slide Maker v3 Implementation Plan — Zone-Based Composition

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace freeform canvas with zone-based slide composition matching the actual CUNY AI Lab deck framework — 7 layouts, 12 module types, zone flow instead of absolute positioning.

**Architecture:** Schema migration (new layout enum, zone field, remove x/y positioning). SlideRenderer rewrite with zone containers. New module renderers. Module picker UI. Export produces the real framework HTML/CSS/JS. System prompt updated for new module vocabulary.

**Tech Stack:** Existing stack (SvelteKit 5, Hono, SQLite/Drizzle, TipTap, svelte-dnd-action, @chenglou/pretext). Remove: moveable.js (no more freeform positioning). Add: framework CSS/JS assets for export.

**Spec:** `docs/superpowers/specs/2026-03-28-slide-maker-v3-design.md`

---

## File Map

```
packages/shared/src/
  types.ts                          ← MODIFY: new layout types, module types, zone field
  block-types.ts                    ← REWRITE: replace block types with module types
  mutations.ts                      ← MODIFY: update payload types for new model

apps/api/src/
  db/schema.ts                      ← MODIFY: slides.layout new enum, contentBlocks add zone, remove layout JSON
  db/seed.ts                        ← MODIFY: seed new templates matching layouts
  prompts/system.ts                 ← REWRITE: new module types, layouts, zone model
  export/
    html-renderer.ts                ← REWRITE: produce actual framework HTML
    navigation.ts                   ← REWRITE: actual deck-engine.js
    framework-css.ts                ← NEW: styles.css + responsive.css + animations.css
    carousel.ts                     ← NEW: carousel.js for export
    scrubber.ts                     ← NEW: scrubber.js for export

apps/web/src/lib/
  components/
    canvas/
      SlideRenderer.svelte          ← REWRITE: zone-based layouts
      BlockWrapper.svelte           ← DELETE: no more freeform positioning
      ZoneDrop.svelte               ← NEW: droppable zone container with dnd
      SplitHandle.svelte            ← NEW: draggable divider for split layout
      FormatToolbar.svelte          ← KEEP: already works
      SlideCanvas.svelte            ← MODIFY: remove BlockWrapper references
      CanvasToolbar.svelte          ← KEEP
    renderers/
      ModuleRenderer.svelte         ← NEW: replaces BlockRenderer, dispatches by module type
      HeadingModule.svelte          ← RENAME from HeadingBlock (minor tweaks)
      TextModule.svelte             ← RENAME from TextBlock (keep TipTap)
      CardModule.svelte             ← NEW: colored card with step reveal
      LabelModule.svelte            ← NEW: small colored pill badge
      TipBoxModule.svelte           ← NEW: callout box with accent border
      PromptBlockModule.svelte      ← NEW: code/prompt with quality indicator
      ImageModule.svelte            ← RENAME from ImageBlock
      CarouselModule.svelte         ← NEW: image slider with dots
      ComparisonModule.svelte       ← NEW: side-by-side panels
      CardGridModule.svelte         ← RENAME from CardGridBlock
      FlowModule.svelte             ← NEW: vertical process flow with arrows
      StreamListModule.svelte       ← NEW: styled bullet list
      RichTextEditor.svelte         ← KEEP
    outline/
      AddSlideMenu.svelte           ← REWRITE: layout picker instead of type picker
      ModulePicker.svelte           ← NEW: "Choose a type" module picker for zones
      SlideCard.svelte              ← MODIFY: show layout name, zone indicators
      BlockItem.svelte              ← RENAME conceptually to module items
    resources/
      TemplatesTab.svelte           ← MODIFY: templates use new layout types

templates/                          ← REWRITE: all template JSONs use new layouts + modules
```

---

## Task 1: Schema Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/block-types.ts`
- Modify: `packages/shared/src/mutations.ts`

- [ ] **Step 1: Update slides table schema**

In `apps/api/src/db/schema.ts`, replace the slides table definition:

```typescript
export const slides = sqliteTable('slides', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  layout: text('layout').notNull().default('layout-split'),
  order: integer('order').notNull(),
  splitRatio: text('split_ratio').notNull().default('0.45'), // stored as string, parsed to number
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})
```

Changes from old:
- Remove `type` field (replaced by `layout`)
- Remove `fragments` field (replaced by per-module `stepOrder`)
- `layout` values: `'title-slide' | 'layout-split' | 'layout-content' | 'layout-grid' | 'layout-full-dark' | 'layout-divider' | 'closing-slide'`
- Add `splitRatio` (for layout-split proportion)

- [ ] **Step 2: Update content_blocks table**

```typescript
export const contentBlocks = sqliteTable('content_blocks', {
  id: text('id').primaryKey(),
  slideId: text('slide_id').notNull().references(() => slides.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  zone: text('zone').notNull().default('content'), // 'content' | 'stage' | 'main' | 'hero'
  data: text('data', { mode: 'json' }).notNull().default('{}'),
  order: integer('order').notNull(),
  stepOrder: integer('step_order'), // nullable, for progressive reveal
})
```

Changes: Remove `layout` JSON field (no more x/y/width/height). Add `zone` field. Keep `stepOrder` (renamed from `fragmentOrder`).

- [ ] **Step 3: Update templates table**

```typescript
export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  layout: text('layout').notNull(), // was slideType
  modules: text('modules', { mode: 'json' }).notNull().default('[]'), // was blocks
  thumbnail: text('thumbnail'),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by'),
})
```

- [ ] **Step 4: Push schema**

```bash
cd apps/api && pnpm drizzle-kit push
```

Note: This will require data migration since column names changed. For dev, it's OK to drop and recreate — the seed script will repopulate. For any existing data, we'll need a migration script, but for now just push.

- [ ] **Step 5: Update shared types**

Rewrite `packages/shared/src/block-types.ts` — rename to module types:

```typescript
export const LAYOUTS = [
  'title-slide',
  'layout-split',
  'layout-content',
  'layout-grid',
  'layout-full-dark',
  'layout-divider',
  'closing-slide',
] as const

export type SlideLayout = (typeof LAYOUTS)[number]

export const ZONES = ['content', 'stage', 'main', 'hero'] as const
export type Zone = (typeof ZONES)[number]

export const MODULE_TYPES = [
  'heading',
  'text',
  'card',
  'label',
  'tip-box',
  'prompt-block',
  'image',
  'carousel',
  'comparison',
  'card-grid',
  'flow',
  'stream-list',
] as const

export type ModuleType = (typeof MODULE_TYPES)[number]

// Data shapes for each module
export interface HeadingData { text: string; level: 1 | 2 | 3 | 4 }
export interface TextData { markdown?: string; html?: string }
export interface CardData { content: string; variant?: 'cyan' | 'navy' | 'default' }
export interface LabelData { text: string; color: 'cyan' | 'blue' | 'navy' | 'red' | 'amber' | 'green' }
export interface TipBoxData { content: string; title?: string }
export interface PromptBlockData { content: string; quality?: 'good' | 'mid' | 'bad'; language?: string }
export interface ImageData { src: string; alt: string; caption?: string; fit?: 'cover' | 'contain' }
export interface CarouselData { items: { src: string; caption?: string }[]; syncSteps?: boolean }
export interface ComparisonData { panels: { title: string; content: string }[] }
export interface CardGridData { cards: { title: string; content: string; icon?: string; color?: string }[]; columns?: 2 | 3 | 4 }
export interface FlowData { nodes: { icon?: string; label: string; description?: string }[] }
export interface StreamListData { items: string[] }
```

Update `types.ts` to use new types (SlideLayout, Zone, ModuleType instead of SlideType, BlockType).

Update `mutations.ts` — the `addSlide` payload gets `layout` instead of `type`, blocks become modules with `zone` field.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: migrate schema to zone-based layouts and module types

7 slide layouts, 12 module types, zone field on modules.
Remove absolute positioning (x/y/width/height layout).
Add splitRatio for layout-split proportion."
```

---

## Task 2: SlideRenderer Rewrite — Zone-Based Layouts

**Files:**
- Rewrite: `apps/web/src/lib/components/canvas/SlideRenderer.svelte`
- Delete: `apps/web/src/lib/components/canvas/BlockWrapper.svelte`
- Create: `apps/web/src/lib/components/canvas/ZoneDrop.svelte`
- Create: `apps/web/src/lib/components/canvas/SplitHandle.svelte`
- Modify: `apps/web/src/lib/components/canvas/SlideCanvas.svelte`

- [ ] **Step 1: Create ZoneDrop component**

`apps/web/src/lib/components/canvas/ZoneDrop.svelte` — A zone container that holds modules and supports drag reordering via svelte-dnd-action.

Props: `modules` (array), `zone` (string), `editable` (boolean), `onReorder` callback, `onModuleDataChange` callback, `onEditorReady` callback

Renders modules vertically using svelte-dnd-action for reorder. Each module wrapped in ModuleRenderer.

- [ ] **Step 2: Create SplitHandle component**

`apps/web/src/lib/components/canvas/SplitHandle.svelte` — Draggable vertical divider for layout-split slides.

Props: `ratio` (number 0-1), `onRatioChange` callback

On mousedown: start dragging, track mouse position, compute new ratio, call callback. Persist ratio to API.

- [ ] **Step 3: Rewrite SlideRenderer**

`apps/web/src/lib/components/canvas/SlideRenderer.svelte` — Now renders zone-based layouts:

```svelte
{#if layout === 'title-slide' || layout === 'layout-divider' || layout === 'closing-slide'}
  <div class="slide {layout}">
    <ZoneDrop zone="hero" modules={heroModules} {editable} ... />
  </div>
{:else if layout === 'layout-split'}
  <div class="slide layout-split">
    <div class="content" style="flex: 0 0 {splitRatio * 100}%">
      <ZoneDrop zone="content" modules={contentModules} {editable} ... />
    </div>
    <SplitHandle ratio={splitRatio} onRatioChange={handleSplitChange} />
    <div class="stage" style="flex: 0 0 {(1 - splitRatio) * 100}%">
      <ZoneDrop zone="stage" modules={stageModules} {editable} ... />
    </div>
  </div>
{:else}
  <!-- layout-content, layout-grid, layout-full-dark -->
  <div class="slide {layout}">
    <ZoneDrop zone="main" modules={mainModules} {editable} ... />
  </div>
{/if}
```

CSS for each layout matching the actual framework:
- `title-slide`: centered, gradient background, large spacing
- `layout-split`: flex row, content left + stage right
- `layout-content`: full width, single column
- `layout-grid`: full width, CSS grid on the card-grid modules
- `layout-full-dark`: dark background (#0b0e14), light text
- `layout-divider`: centered, accent gradient, decorative line
- `closing-slide`: centered, dark gradient

Derive modules by zone: `contentModules`, `stageModules`, `mainModules`, `heroModules` from the slide's modules filtered by `zone`.

- [ ] **Step 4: Delete BlockWrapper.svelte**

Remove `apps/web/src/lib/components/canvas/BlockWrapper.svelte` — no more freeform positioning.

- [ ] **Step 5: Update SlideCanvas**

Remove BlockWrapper import. The FormatToolbar and onEditorReady flow stays the same.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: rewrite SlideRenderer with zone-based layouts

7 layout types with zone containers. Modules flow vertically
within zones, reorderable via drag. Split layout has draggable
divider for proportion adjustment. No more absolute positioning."
```

---

## Task 3: Module Renderers

**Files:**
- Create: `apps/web/src/lib/components/renderers/ModuleRenderer.svelte`
- Rename/modify existing renderers, create new ones

- [ ] **Step 1: Create ModuleRenderer dispatcher**

`apps/web/src/lib/components/renderers/ModuleRenderer.svelte` — Same pattern as old BlockRenderer but with new module types:

```typescript
const rendererMap: Record<string, any> = {
  heading: HeadingModule,
  text: TextModule,
  card: CardModule,
  label: LabelModule,
  'tip-box': TipBoxModule,
  'prompt-block': PromptBlockModule,
  image: ImageModule,
  carousel: CarouselModule,
  comparison: ComparisonModule,
  'card-grid': CardGridModule,
  flow: FlowModule,
  'stream-list': StreamListModule,
}
```

Pass `editable`, `onchange`, `oneditorready`, `stepOrder` through.

Show step badge if `module.stepOrder != null`. In edit mode, step modules show at reduced opacity.

- [ ] **Step 2: Create new module renderers**

For each new module type, create a Svelte 5 component. Use the CSS patterns from the actual framework analysis.

**CardModule.svelte**: Colored left-border card. Variants: cyan (default), navy, no-border. Content supports TipTap editing. Step reveal support.

```css
.card { border-left: 4px solid var(--accent-cyan); padding: 1rem 1.25rem; background: rgba(121,192,255,0.06); border-radius: 0 6px 6px 0; }
.card-navy { border-left-color: var(--accent-navy); background: rgba(29,58,131,0.06); }
```

**LabelModule.svelte**: Small uppercase pill.

```css
.label { display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.75rem; border-radius: 3px; background: rgba(121,192,255,0.15); color: var(--accent-cyan); }
.label-red { background: rgba(255,107,107,0.15); color: var(--accent-red); }
/* etc for each color */
```

**TipBoxModule.svelte**: Highlighted callout.

```css
.tip-box { background: rgba(121,192,255,0.1); border-left: 4px solid var(--accent-cyan); padding: 1rem 1.25rem; border-radius: 0 6px 6px 0; }
```

**PromptBlockModule.svelte**: Code/prompt display with quality indicator. Dark background, monospace, colored left border for quality (green=good, amber=mid, red=bad).

```css
.prompt-block { background: #0b0e14; color: rgba(255,255,255,0.92); font-family: 'JetBrains Mono'; padding: 1rem; border-radius: 6px; border-left: 4px solid var(--accent-cyan); }
.prompt-good { border-left-color: var(--accent-green); }
.prompt-mid { border-left-color: var(--accent-amber); }
.prompt-bad { border-left-color: var(--accent-red); }
```

**CarouselModule.svelte**: Image slider with navigation dots. Stores active index in local state. Shows active image + dots below. Next/prev on click. If `syncSteps`, controlled by parent step system.

**ComparisonModule.svelte**: Two panels side by side with a vertical divider.

```css
.comparison { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--stroke); border-radius: 6px; overflow: hidden; }
.comparison-panel { padding: 1rem 1.25rem; }
.comparison-panel + .comparison-panel { border-left: 1px solid var(--stroke); }
```

**FlowModule.svelte**: Vertical process flow — nodes connected by arrows.

```css
.flow-node { display: flex; align-items: flex-start; gap: 1rem; }
.flow-node-icon { width: 3rem; height: 3rem; border-radius: 50%; background: var(--accent-cyan); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.flow-arrow { width: 2px; height: 2rem; background: var(--accent-cyan); margin-left: 1.5rem; opacity: 0.4; }
```

**StreamListModule.svelte**: Styled bullet list with accent markers.

```css
.stream-list { list-style: none; padding: 0; }
.stream-list li { padding: 0.4rem 0 0.4rem 1.5rem; position: relative; }
.stream-list li::before { content: ''; position: absolute; left: 0; top: 0.85rem; width: 6px; height: 6px; border-radius: 50%; background: var(--accent-cyan); }
```

- [ ] **Step 3: Adapt existing renderers**

Rename and update:
- `HeadingBlock.svelte` → `HeadingModule.svelte` (same logic, same TipTap/pretext)
- `TextBlock.svelte` → `TextModule.svelte` (same TipTap/pretext)
- `ImageBlock.svelte` → `ImageModule.svelte` (same, keep src/url fallback)
- `CardGridBlock.svelte` → `CardGridModule.svelte` (update CSS to match framework)

Delete old files: `BlockRenderer.svelte`, `QuoteBlock.svelte`, `StepsBlock.svelte`, `CodeBlock.svelte`, `EmbedBlock.svelte`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add 12 module renderers matching actual deck framework

Card, label, tip-box, prompt-block, carousel, comparison, flow,
stream-list modules. CSS matches knowledge-collections deck patterns."
```

---

## Task 4: Module Picker + AddSlide Rewrite

**Files:**
- Create: `apps/web/src/lib/components/outline/ModulePicker.svelte`
- Rewrite: `apps/web/src/lib/components/outline/AddSlideMenu.svelte`
- Modify: `apps/web/src/lib/components/outline/SlideCard.svelte`

- [ ] **Step 1: Rewrite AddSlideMenu as layout picker**

Replace the 4 slide types with 7 layouts:

```typescript
const layouts = [
  { layout: 'title-slide', label: 'Title Slide', icon: '🎯', desc: 'Cover with title + subtitle' },
  { layout: 'layout-split', label: 'Split (Text + Visual)', icon: '◧', desc: 'Left text, right image/carousel' },
  { layout: 'layout-content', label: 'Full Content', icon: '▣', desc: 'Single column, full width' },
  { layout: 'layout-grid', label: 'Card Grid', icon: '▦', desc: 'Multi-column card layout' },
  { layout: 'layout-full-dark', label: 'Dark Section', icon: '◼', desc: 'Dark background overview' },
  { layout: 'layout-divider', label: 'Section Break', icon: '─', desc: 'Part label divider' },
  { layout: 'closing-slide', label: 'Closing', icon: '🏁', desc: 'Final slide, recap' },
]
```

When clicked: `POST /api/decks/:id/slides` with `{ layout: 'layout-split' }` (not `type`).

- [ ] **Step 2: Create ModulePicker**

`apps/web/src/lib/components/outline/ModulePicker.svelte` — The "Choose a type" widget picker.

Shows when user clicks "+ Module" inside an expanded slide card or inside a zone.

Grid/list of 12 module types with icon + name. On click: creates the module in the specified zone via API (`POST /api/decks/:id/slides/:slideId/blocks` with `{ type, zone, data }`).

```typescript
const moduleTypes = [
  { type: 'heading', label: 'Heading', icon: 'H', desc: 'Title or subtitle' },
  { type: 'text', label: 'Text', icon: '¶', desc: 'Paragraph with formatting' },
  { type: 'card', label: 'Card', icon: '▭', desc: 'Colored info card' },
  { type: 'label', label: 'Label', icon: '◉', desc: 'Section tag badge' },
  { type: 'tip-box', label: 'Callout', icon: '💡', desc: 'Highlighted tip/note' },
  { type: 'prompt-block', label: 'Code Block', icon: '⌨', desc: 'Code or prompt' },
  { type: 'image', label: 'Image', icon: '🖼', desc: 'Single image' },
  { type: 'carousel', label: 'Carousel', icon: '⟳', desc: 'Image slider' },
  { type: 'comparison', label: 'Comparison', icon: '⟺', desc: 'Side-by-side panels' },
  { type: 'card-grid', label: 'Card Grid', icon: '▦', desc: 'Multi-card grid' },
  { type: 'flow', label: 'Process Flow', icon: '↓', desc: 'Step-by-step flow' },
  { type: 'stream-list', label: 'List', icon: '☰', desc: 'Styled bullet list' },
]
```

- [ ] **Step 3: Update SlideCard**

Show layout name instead of old type. In expanded view, show zones with modules grouped by zone. Add "+ Module" button per zone that opens ModulePicker.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add layout picker and module picker UI

7 slide layouts in add menu. 12 module types in zone picker.
Outline shows layout name and zone grouping."
```

---

## Task 5: Update API Routes + Mutations

**Files:**
- Modify: `apps/api/src/routes/decks.ts`
- Modify: `apps/web/src/lib/utils/mutations.ts`
- Modify: `apps/web/src/lib/stores/deck.ts`

- [ ] **Step 1: Update deck routes for new schema**

In `apps/api/src/routes/decks.ts`:
- `POST /:id/slides` accepts `{ layout, splitRatio? }` instead of `{ type }`
- `POST /:id/slides/:slideId/blocks` accepts `{ type, zone, data, stepOrder? }`
- `PATCH /:id/slides/:slideId` accepts `{ splitRatio?, notes? }` (no more fragments)
- GET endpoints return the new fields

- [ ] **Step 2: Update mutations.ts**

The `addSlide` mutation payload changes:
```typescript
case 'addSlide': {
  const result = await apiCall(`/api/decks/${deck.id}/slides`, 'POST', {
    layout: (payload.layout as string) || 'layout-split',
    modules: payload.modules, // array of { type, zone, data, stepOrder? }
  })
  // ...
}
```

The `addBlock` → `addModule` rename. Zone field included.

- [ ] **Step 3: Update deck store types**

Update the interfaces in `apps/web/src/lib/stores/deck.ts` to match new schema (layout, zone, no x/y/width/height).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: update API routes and mutations for zone-based model"
```

---

## Task 6: System Prompt Rewrite

**Files:**
- Rewrite: `apps/api/src/prompts/system.ts`

- [ ] **Step 1: Rewrite system prompt**

Complete rewrite with:
- New layout types (7) with descriptions and when to use each
- New module types (12) with exact data shapes
- Zone model: which zones each layout has, how to assign modules to zones
- Step reveal: how stepOrder works, carousel sync
- Examples: a complete layout-split slide with content zone (label + heading + cards) and stage zone (carousel)

The prompt must be very explicit about:
1. Use ONLY these 12 module types
2. Every module MUST specify a `zone` field
3. For `layout-split`: use `zone: "content"` for left, `zone: "stage"` for right
4. For all other layouts: use `zone: "main"` (or `zone: "hero"` for title/divider/closing)

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: rewrite system prompt for zone-based module model"
```

---

## Task 7: Seed New Templates

**Files:**
- Rewrite all files in `templates/`
- Modify: `apps/api/src/db/seed.ts`

- [ ] **Step 1: Create new template JSONs**

Replace all template files with new ones using layouts + modules + zones:

Example `templates/layout-split/text-and-carousel.json`:
```json
{
  "name": "Text + Carousel",
  "layout": "layout-split",
  "modules": [
    { "type": "label", "zone": "content", "data": { "text": "", "color": "cyan" } },
    { "type": "heading", "zone": "content", "data": { "text": "", "level": 2 } },
    { "type": "text", "zone": "content", "data": { "markdown": "" } },
    { "type": "carousel", "zone": "stage", "data": { "items": [], "syncSteps": false } }
  ]
}
```

Create ~15 templates covering all 7 layouts:
- `title-slide/branded-hero.json`, `title-slide/minimal.json`
- `layout-split/text-and-carousel.json`, `layout-split/text-and-image.json`, `layout-split/cards-and-image.json`, `layout-split/comparison.json`
- `layout-content/full-text.json`, `layout-content/comparison-panels.json`
- `layout-grid/card-grid-3.json`, `layout-grid/model-grid.json`
- `layout-full-dark/roadmap.json`, `layout-full-dark/overview.json`
- `layout-divider/section-break.json`
- `closing-slide/recap.json`

- [ ] **Step 2: Update seed script**

Update `apps/api/src/db/seed.ts` to read new template format (layout + modules instead of slideType + blocks). Clear old templates before seeding.

- [ ] **Step 3: Run seed**

```bash
pnpm db:push && pnpm db:seed
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: seed 15 templates with zone-based layouts and modules"
```

---

## Task 8: Export Rewrite — Actual Framework

**Files:**
- Rewrite: `apps/api/src/export/html-renderer.ts`
- Rewrite: `apps/api/src/export/navigation.ts`
- Create: `apps/api/src/export/framework-css.ts`
- Create: `apps/api/src/export/carousel.ts`
- Create: `apps/api/src/export/scrubber.ts`
- Modify: `apps/api/src/export/index.ts`

- [ ] **Step 1: Create framework CSS**

`apps/api/src/export/framework-css.ts` — export a string constant `FRAMEWORK_CSS` containing styles.css content matching the actual deck framework:

Layout classes (`.title-slide`, `.layout-split`, `.layout-content`, etc.), module styles (`.card`, `.label`, `.tip-box`, `.prompt-block`, `.carousel`, etc.), color variables, responsive typography with `clamp()`, step reveal animations (`.step-hidden`, `.step-visible`), dark mode for `.layout-full-dark`, nav bar styles.

- [ ] **Step 2: Create deck-engine.js**

Rewrite `navigation.ts` to match the actual framework's deck-engine.js:
- Slide navigation (keyboard arrows, nav buttons)
- Step reveal system (`step-hidden` → `step-visible` with `data-step`)
- Carousel sync with steps
- Scrubber/progress bar integration
- URL hash navigation
- Accessibility (ARIA, screen reader announcements)

- [ ] **Step 3: Create carousel.js and scrubber.js**

`carousel.ts` — carousel JS (dot navigation, auto-rotate, image switching)
`scrubber.ts` — progress scrubber bar at bottom

- [ ] **Step 4: Rewrite HTML renderer**

`html-renderer.ts` — produces HTML matching the actual framework structure:

```html
<div id="deck">
  <div class="slide layout-split" role="group" aria-roledescription="slide" aria-label="Slide N: Title">
    <div class="content">
      <span class="label label-cyan">Section</span>
      <h2>Title</h2>
      <div class="card step-hidden" data-step="1">...</div>
    </div>
    <div class="stage">
      <div class="carousel" data-sync-steps>...</div>
    </div>
  </div>
</div>
<nav id="nav-bar">...</nav>
```

Each module type renders to its framework HTML equivalent.

- [ ] **Step 5: Update export orchestrator**

Bundle: index.html + css/styles.css + css/responsive.css + css/animations.css + js/deck-engine.js + js/carousel.js + js/scrubber.js + assets/

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: export produces actual CUNY AI Lab deck framework HTML/CSS/JS

Slides use real layout classes, modules render as framework components,
step reveal system with carousel sync, accessible nav bar with scrubber."
```

---

## Task 9: Chat Improvements

**Files:**
- Modify: `apps/web/src/lib/components/chat/ChatPanel.svelte`
- Modify: `apps/web/src/lib/components/chat/ChatInput.svelte`

- [ ] **Step 1: Live mutation preview during streaming**

Change mutation extraction from "wait until done" to "parse as they appear during streaming":

In `ChatPanel.svelte`, instead of extracting all mutations after `onDone`, detect ` ```mutation ` blocks as they stream in and apply them immediately. Track open/close fences in the streaming text.

- [ ] **Step 2: Canvas highlight on mutation**

When a mutation is applied, briefly highlight the affected zone/module with a CSS animation (blue glow, 0.5s). Add a `highlightModule` store or use a CSS class that auto-removes.

- [ ] **Step 3: /add command**

In `ChatInput.svelte`, detect when user types `/add`. Show inline module picker (same ModulePicker component). When a module type is selected, insert it into the active slide's appropriate zone and prefill the chat with context.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: live mutation preview, canvas highlights, /add command"
```

---

## Task 10: Wiring + Polish

**Files:**
- Modify: various — final integration pass
- Modify: `CLAUDE.md` — update for v3

- [ ] **Step 1: Wire everything together**

- Verify: add slide (layout picker) → creates slide with zones → add modules via picker or chat → render in zones → export as framework HTML
- Fix any broken imports from renamed files
- Update TemplatesTab to show new template format
- Verify chat agent creates slides with correct layout + zone + module format

- [ ] **Step 2: Update CLAUDE.md**

Replace block types with module types. Update layout documentation. Document zone model.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat: complete v3 zone-based composition with full wiring"
git push origin main
```
