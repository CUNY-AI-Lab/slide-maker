# Slide Maker v3 — Design Spec: Zone-Based Composition

## The Problem

v1/v2 built a freeform canvas editor (Canva-style) where blocks float at arbitrary x/y positions. The CUNY AI Lab's actual slide decks use a **structured framework** with fixed layout zones and composable modules. The tool needs to produce decks that look and behave like the existing ones — not freeform canvases.

## The Fix

Replace freeform positioning with **zone-based composition** that matches the actual deck framework, while keeping the rich editing UX (TipTap, resize, pretext text reflow, drag reorder).

---

## 1. Layout System — 7 Slide Layouts (from actual decks)

Every slide picks a layout. The layout defines **zones** — fixed regions that modules snap into.

| Layout | Zones | Use Case |
|--------|-------|----------|
| `title-slide` | `hero` (centered full) | Cover slide — logo, title, subtitle, metadata |
| `layout-split` | `content` (left ~45%) + `stage` (right ~55%) | ~70% of slides — text left, visual right |
| `layout-content` | `main` (full width) | Single-column — comparisons, full-width lists |
| `layout-grid` | `main` (full width, CSS grid) | Card grids — best practices, features, tools |
| `layout-full-dark` | `main` (full width, dark bg) | Section overviews, roadmaps, recaps |
| `layout-divider` | `hero` (centered) | Section breaks — part labels, decorative lines |
| `closing-slide` | `hero` (centered full) | Final slide — recap, CTA, contact |

### Zone Resizing

In `layout-split`, users can **drag the divider** between content and stage to adjust proportions (e.g., 40/60, 50/50, 60/40). This uses the same resize handle pattern from v2's EditorShell panels. The ratio is stored on the slide (`splitRatio: number`, default 0.45).

### What replaces the old system

- Old: `slide.type` = title | section-divider | body | resources
- New: `slide.layout` = title-slide | layout-split | layout-content | layout-grid | layout-full-dark | layout-divider | closing-slide
- Old: `block.layout` = {x, y, width, height} (absolute positioning)
- New: `module.zone` = 'content' | 'stage' | 'main' | 'hero' (which zone it belongs to)
- Old: blocks positioned anywhere
- New: modules flow vertically within their zone, reorderable via drag

---

## 2. Module System — 12 Module Types (from actual decks)

Modules are the building blocks users drop into zones. Each has a defined structure and styling.

| Module | Data Shape | Renders As |
|--------|-----------|------------|
| `heading` | `{ text, level: 1-4 }` | h1-h4 with display font |
| `text` | `{ markdown }` | Paragraphs, inline formatting (TipTap editing) |
| `card` | `{ content, variant?: 'cyan'|'navy'|'default', stepOrder?: number }` | Colored left-border card with optional step reveal |
| `label` | `{ text, color: 'cyan'|'blue'|'navy'|'red'|'amber'|'green' }` | Small uppercase pill badge |
| `tip-box` | `{ content, title? }` | Highlighted callout box with accent border |
| `prompt-block` | `{ content, quality?: 'good'|'mid'|'bad', language? }` | Code/prompt display with quality indicator |
| `image` | `{ src, alt, caption?, fit?: 'cover'|'contain' }` | Image with optional caption |
| `carousel` | `{ items: [{ src, caption }], syncSteps?: boolean }` | Image slider with dots and optional step sync |
| `comparison` | `{ panels: [{ title, content }] }` | Side-by-side comparison panels |
| `card-grid` | `{ cards: [{ title, content, icon?, color? }], columns: 2-4 }` | Multi-column card grid |
| `flow` | `{ nodes: [{ icon?, label, description }] }` | Vertical process flow with arrows |
| `stream-list` | `{ items: string[] }` | Styled bullet list with accent markers |

### How modules relate to old block types

| Old Block Type | New Module(s) |
|---------------|---------------|
| `heading` | `heading` (same) |
| `text` | `text` (same) |
| `image` | `image` + `carousel` (new) |
| `code` | `prompt-block` (expanded — supports quality indicators) |
| `quote` | `tip-box` (repurposed — quotes go in tip-box or card) |
| `steps` | `card` with `stepOrder` (integrated with step reveal system) |
| `card-grid` | `card-grid` (same) + `comparison` (new) |
| `embed` | kept as-is for iframes |

---

## 3. Zone-Based Rendering

### SlideRenderer Rewrite

The SlideRenderer reads `slide.layout` and creates the appropriate zone structure:

```html
<!-- layout-split -->
<div class="slide layout-split">
  <div class="content" style="flex: 0 0 {splitRatio * 100}%">
    <!-- modules with zone='content' rendered here, vertically, reorderable -->
  </div>
  <div class="stage" style="flex: 0 0 {(1 - splitRatio) * 100}%">
    <!-- modules with zone='stage' rendered here -->
  </div>
</div>

<!-- layout-grid -->
<div class="slide layout-grid">
  <div class="main">
    <!-- all modules rendered in grid -->
  </div>
</div>
```

### Module Ordering Within Zones

Modules within a zone are **vertically stacked** and **reorderable via drag** (svelte-dnd-action, same as v2's block reordering). No absolute positioning.

### Zone Resizing

For `layout-split`, a drag handle between content and stage lets users adjust the column ratio. Stored as `slide.splitRatio` in the DB.

---

## 4. What We Keep From v2

### TipTap Rich Text Editing
- Double-click a `text` or `card` or `tip-box` module to edit with TipTap
- Format toolbar (B/I/Link/List) stays fixed above the slide frame
- Works exactly as built — just the trigger surface changes (zones instead of freeform blocks)

### @chenglou/pretext Text Reflow
- Text modules auto-shrink when content overflows the zone
- Headings auto-fit to zone width
- Same `fitText()` utility, same integration

### svelte-dnd-action
- Reorder modules within a zone by dragging
- Reorder slides in the outline
- Same library, same pattern

### File Upload + Insert
- Upload images, insert into slides via Files tab or chat drag-and-drop
- Same API, same UI

### Moveable (limited)
- **Remove** freeform x/y drag positioning
- **Keep** for zone proportion resizing (the split handle)
- Modules don't need moveable — they flow within zones

### Export Pipeline
- Zip export now produces HTML using the **actual framework** CSS/JS (styles.css, responsive.css, animations.css, deck-engine.js, carousel.js, etc.)
- Same nav pattern: keyboard arrows, scrubber bar, step reveals

---

## 5. Improved Chat ↔ Canvas Interaction

### Current problem
The chat creates mutations but the user can't see what's happening until the response finishes. The canvas updates feel disconnected from the conversation.

### Improvements

**a) Live preview during streaming**
Instead of waiting for the full response, apply mutations as they're parsed — not at the end. When the AI emits a ` ```mutation ` block, apply it immediately while streaming continues.

**b) Canvas highlights what changed**
When a mutation is applied, briefly highlight the affected module/zone with a flash animation (subtle blue glow, 0.5s fade). This gives visual feedback: "the AI just changed this."

**c) Contextual chat**
When a user clicks a module on the canvas, the chat input gets prefilled context: "Editing: [module type] in [zone] of Slide [N]". The AI knows exactly what the user is looking at.

**d) Module picker in chat**
Users can type `/add` in the chat to get a quick module picker (dropdown of the 12 types). Selecting one inserts it into the active slide's active zone. Faster than describing what you want.

**e) Undo/redo**
Store mutation history. Ctrl+Z undoes the last mutation (reverse it). Ctrl+Shift+Z redoes. Essential for iterative editing with AI.

---

## 6. Module Picker UI ("Choose a Type" from Vision Doc)

This is the modular composition workflow from the original vision:

1. Click "+ Add Module" in a zone (or in the outline's expanded slide)
2. A picker shows the 12 module types with icons and descriptions
3. Click one → it's inserted into the zone with placeholder content
4. Edit the content directly (TipTap) or via chat

The picker replaces the old "Add Slide" type selector. Adding a slide now means picking a **layout**, then filling zones with **modules**.

---

## 7. Step Reveal System

The actual decks use a powerful step-reveal system:

- Modules can have `stepOrder: number` (nullable)
- Modules with stepOrder are hidden initially, revealed one by one on click/keypress
- Carousels with `syncSteps: true` advance their image when the corresponding step reveals
- On the canvas: step modules show with reduced opacity + "Step N" badge (same as v2 fragments, but integrated with carousel sync)
- In export: uses `step-hidden` class + `data-step="N"` attributes, powered by deck-engine.js

---

## 8. Export — Match the Actual Framework

The export pipeline should produce HTML that uses the same CSS/JS as the existing decks:

### Bundled Assets
```
{slug}/
├── index.html
├── css/
│   ├── styles.css        ← Module styles, layout classes, color variables
│   ├── responsive.css    ← Media queries for mobile/tablet
│   └── animations.css    ← Transitions and step reveal animations
├── js/
│   ├── deck-engine.js    ← Slide navigation, keyboard controls, step reveals
│   ├── carousel.js       ← Image carousel with dots and auto-rotate
│   ├── scrubber.js       ← Bottom progress bar slider
│   └── lightbox.js       ← Image lightbox overlay
├── assets/
│   ├── images/           ← Uploaded images
│   └── data/             ← Data files
└── manifest.json
```

### HTML Structure
```html
<div id="deck">
  <div class="slide title-slide" role="group" aria-roledescription="slide" aria-label="Slide 1: Title">
    <!-- modules -->
  </div>
  <div class="slide layout-split" role="group" aria-roledescription="slide" aria-label="Slide 2: Topic">
    <div class="content"><!-- left modules --></div>
    <div class="stage"><!-- right modules --></div>
  </div>
  <!-- ... -->
</div>
<nav id="nav-bar"><!-- prev/scrubber/next --></nav>
```

### CSS Variables (from actual decks)
```css
:root {
  --accent-cyan: #79c0ff;
  --accent-blue: #2A6FB8;
  --accent-navy: #1D3A83;
  --accent-red: #ff6b6b;
  --accent-amber: #ffd93d;
  --accent-green: #6bcf7f;
  --bg-light: #f8fafc;
}
```

Theming: decks can override these variables. The builder's theme system maps to these CSS custom properties.

---

## 9. Database Schema Changes

### Slides table
- Remove: `type` enum (title | section-divider | body | resources)
- Change: `layout` text field → new enum values (title-slide | layout-split | layout-content | layout-grid | layout-full-dark | layout-divider | closing-slide)
- Add: `splitRatio` real (default 0.45, only used for layout-split)

### Content blocks table → rename to modules
- Remove: `layout` JSON (x, y, width, height) — no more absolute positioning
- Add: `zone` text ('content' | 'stage' | 'main' | 'hero')
- Add: `stepOrder` integer (nullable, for step reveals)
- Change: `type` values to new module types

### Migration
The old data needs to be migrated:
- `slide.type='title'` → `slide.layout='title-slide'`
- `slide.type='section-divider'` → `slide.layout='layout-divider'`
- `slide.type='body'` → `slide.layout='layout-split'` (default)
- `slide.type='resources'` → `slide.layout='layout-content'`
- All blocks get `zone='content'` as default
- Remove all `layout` (x/y/width/height) data from blocks

---

## 10. Priority Order

1. **Schema migration** — new layout types, zone field, remove absolute positioning
2. **SlideRenderer rewrite** — zone-based layouts matching actual framework CSS
3. **Module renderers** — new module types (card, label, tip-box, prompt-block, carousel, comparison, flow, stream-list)
4. **Module picker** — "Choose a type" UI for adding modules to zones
5. **Zone resize** — drag handle for split layout proportions
6. **Step reveal system** — stepOrder + carousel sync
7. **Export rewrite** — produce HTML matching actual framework CSS/JS
8. **Chat improvements** — live mutation preview, highlights, contextual editing, /add command
9. **Undo/redo** — mutation history stack
10. **System prompt update** — new module types, layout types, zone model
