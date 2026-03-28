# Slide Maker v2 — Design Spec

## What v1 Built

The v1 build delivered the full three-panel editor shell, chat-driven AI slide authoring (Anthropic + OpenRouter), auth with CUNY email gating, deck gallery, slide CRUD with persistence, template library (15 templates), zip export with navigation engine, deck sharing with edit locking, and admin dashboard.

## What v2 Fixes and Adds

v2 addresses the gaps that surfaced during v1 testing and the deferred items from the original vision doc.

---

## 1. Text Measurement & Reflow — chenglou/pretext Integration

**Package:** `@chenglou/pretext` (npm, browser-ready, ~0.09ms per layout calculation)

**Problem:** Text content overflows its container on slides. Blocks don't adapt to available space. There's no way to know how much text fits in a given area.

**Solution:** Integrate chenglou/pretext as the text measurement layer for all text-bearing blocks (heading, text, quote, steps, card-grid). When a block is rendered or resized, use `prepare()` + `layout()` to:
- Calculate how many lines of text fit at a given width
- Auto-scale font size if text overflows its container
- Provide accurate height measurements so the slide layout can allocate space correctly
- Enable responsive text reflow when blocks are resized via drag handles

**Integration points:**
- `TextBlock.svelte` — measure markdown-rendered text, auto-shrink if overflow
- `HeadingBlock.svelte` — auto-scale heading font size to fit container width
- `QuoteBlock.svelte` — measure quote text, ensure it fits with attribution
- `SlideRenderer.svelte` — use text measurements to distribute vertical space among blocks

**API usage:**
```typescript
import { prepare, layout } from '@chenglou/pretext'

// Measure text for a given font and container width
const prepared = prepare(text, `${fontWeight} ${fontSize} ${fontFamily}`)
const { height, lineCount } = layout(prepared, containerWidth, lineHeight)

// If height > available height, reduce font size and re-measure
```

**NOTE on PreTeXtBook/pretext:** This is a server-side Python/XSLT toolchain for authoring scholarly documents as XML. It is NOT a browser JavaScript library and cannot be integrated into a Svelte app. However, its semantic vocabulary (sections, definitions, figures, side-by-side layouts) informed our block type system. If we ever want PreTeXt XML import/export, it would be a server-side pipeline in the API, not a frontend integration.

---

## 2. Block Resize & Drag — Interactive Canvas Editing

**Libraries:**
- `svelte-moveable` — Svelte wrapper for moveable.js. Supports drag, resize, scale, rotate, snap, group selection. Most feature-complete option for canvas manipulation.
- `@neodrag/svelte` — lightweight Svelte-native drag action (1.97 KB). Used for slide reordering in the outline.
- `svelte-dnd-action` — drag-and-drop with Svelte 5 support. Used for reordering slides and blocks in the outline panel.

**What users can do:**
- **Resize blocks** on the canvas via corner/edge drag handles. Text reflows as you resize (powered by chenglou/pretext).
- **Move blocks** within a slide by dragging. Position stored in `layout.x, layout.y` on the content_blocks table.
- **Snap to grid** — optional alignment grid (configurable spacing). Snap to other block edges.
- **Reorder slides** in the outline panel by dragging cards up/down.
- **Reorder blocks** within a slide by dragging block items in the expanded accordion.

**Architecture:**
- Wrap each block on the canvas with `svelte-moveable` for resize + drag
- On resize: call chenglou/pretext to reflow text, then persist the new layout dimensions via `PATCH /api/decks/:id/slides/:slideId/blocks/:blockId`
- On drag: update `layout.x, layout.y`, persist
- Outline uses `svelte-dnd-action` for slide and block reordering, persists via `POST /api/decks/:id/slides/reorder`

---

## 3. File Upload

**Problem:** No way to add images or files to slides. The Files tab says "Coming soon."

**Solution:**
- **Upload endpoint:** `POST /api/decks/:id/files` — accepts multipart form data, stores files in `uploads/{deckId}/` on disk, records in `uploaded_files` table
- **File browser:** The Files tab shows all uploaded files for the current deck with thumbnails for images
- **Insert into slides:** Click a file to insert it as an `image` block on the active slide, or drag from the Files tab onto the canvas
- **Storage:** Local disk for dev, configurable path for production (can swap to S3 later)
- **Size limits:** 10MB per file, image types (png, jpg, gif, svg, webp) + pdf, csv, json, geojson

**API:**
```
POST /api/decks/:id/files          — upload (multipart/form-data)
GET  /api/decks/:id/files          — list files for deck
GET  /api/decks/:id/files/:fileId  — serve file content
DELETE /api/decks/:id/files/:fileId — delete file
```

**Frontend:**
- Upload button + drag-and-drop zone in Files tab
- Image thumbnails with filename and size
- Click to insert into active slide as image block
- Uploaded file URLs served from `/api/decks/:id/files/:fileId` and used in image block `src`

---

## 4. Slide Rendering Quality — Matching Existing Decks

**Problem:** Slides still look like a web page, not like the existing CUNY AI Lab presentation decks. The v1 rendering overhaul improved things but the typography, spacing, and visual hierarchy need more work.

**What the existing decks do (from repo analysis):**
- **Typography:** `clamp()` everywhere, font pairing (serif display + sans body), heading hierarchy with dramatic size differences
- **Title slides:** Dark gradient backgrounds, huge centered text, metadata below
- **Section dividers:** Warm/accent gradient backgrounds, large heading with decorative divider line, white text
- **Cards:** Subtle semi-transparent backgrounds, colored left borders, glassmorphism with `backdrop-filter: blur()`
- **Code blocks:** Terminal-dark (#010409), JetBrains Mono, syntax-highlighted, with header bar showing language
- **Quotes:** Large italic display font, prominent accent border, generous padding
- **Process flows:** CSS-styled node + arrow sequences with staggered animations
- **Fragment reveals:** Elements enter with `opacity: 0 → 1` and `translateY(5px → 0)` over 0.35s

**Actions:**
- Add JetBrains Mono font import for code blocks
- Implement fragment/progressive disclosure rendering on body slides
- Add section label headers (persistent category labels above slide titles)
- Add logo/branding bar support (configurable per deck)
- Improve card glassmorphism styling
- Add multi-column layout support (text left + image right, or 50/50 split)
- Add process flow diagram block type (or card-grid variant with arrow connectors)

---

## 5. Multi-Column Slide Layouts

**Problem:** All slides are single-column. The vision doc and existing decks heavily use two-column layouts (text left + image right).

**Solution:** Add a `columns` layout option to slides. When a slide has `layout: 'two-column'`, blocks with `column: 'left'` render on the left half and blocks with `column: 'right'` on the right half.

**Implementation:**
- Add `layout` field to slides table: `'single' | 'two-column' | 'two-column-wide-left' | 'two-column-wide-right'`
- SlideRenderer checks the layout and renders a CSS grid with appropriate column widths
- Blocks specify which column via their existing `data.column` field
- The chat agent and "Add Slide" menu can set the layout

---

## 6. Fragment/Progressive Disclosure

**Problem:** Fragment-based progressive reveal was in the vision doc but only a boolean flag exists. No rendering or editing support.

**Solution:**
- Blocks can be marked as fragments with an order number
- On the canvas, fragments show with reduced opacity and a "step N" badge
- In preview/export, fragments reveal sequentially on click/keypress
- The navigation engine already supports `.fragment` → `.fragment.visible` toggling

**Implementation:**
- Add `fragmentOrder` field to content_blocks (nullable integer)
- Blocks with `fragmentOrder !== null` are fragments
- SlideRenderer applies `opacity: 0.4` to fragment blocks on canvas (for editing visibility)
- Export renderer adds `class="fragment"` and `data-fragment-order` attributes
- Chat agent can specify fragment ordering in mutations

---

## 7. Template Forking via Agent

**Problem:** Users can apply templates but can't fork/customize them through the chat.

**Solution:** Add mutation actions:
- `forkTemplate` — copies an existing template, gives it a new name, saves as user-owned
- `updateTemplate` — modifies a user-owned template's blocks

The agent can suggest "I've created a custom version of the Two Column template for your deck" and fork it on the spot.

---

## 8. Export Improvements

**Current:** Basic zip with HTML + CSS + navigation JS.

**Improvements:**
- Include uploaded images in the zip (`assets/images/`)
- Support fragment rendering in exported HTML
- Add speaker notes panel (press 'S' to toggle)
- Add print-friendly layout (all slides vertical, no nav)
- Generate a thumbnail image for the deck gallery (via html-to-image or similar)

---

## 9. Bug Fixes & Polish from v1 Testing

- [x] Mutations not persisting to DB (fixed — addSlide response shape mismatch)
- [x] System prompt using wrong block types (fixed — aligned with renderers)
- [x] Models list empty (fixed — .env symlink)
- [x] HTML entity showing as text (fixed — &#128465; → ✕)
- [x] Mutation JSON showing in chat (fixed — stripped in renderContent)
- [ ] Gallery doesn't update after deck creation without refresh
- [ ] Chat history not loaded when re-opening a deck (messages lost on navigation)
- [ ] Slide outline doesn't scroll to newly created slide
- [ ] No loading indicator during AI response wait (before first chunk arrives)
- [ ] Admin page accessible by URL even for non-admin users (frontend guard only, no server-side check)
- [ ] Export zip doesn't include uploaded images
- [ ] No way to duplicate a slide
- [ ] No way to duplicate a deck from the gallery

---

## 10. Staging Deployment

**Target:** `tools.cuny.qzz.io/slide-maker`

**Setup:**
- GitHub Actions workflow: on push to `main`, SSH to Debian server, pull, build, restart
- Nginx config: proxy `/slide-maker` to the SvelteKit app, `/slide-maker/api` to the Hono server
- PM2 or systemd for process management
- SQLite DB file in a persistent directory outside the repo
- Uploaded files in a persistent directory
- Environment variables in a server-side `.env` (not in the repo)

---

## Priority Order

1. **File upload** — unblocks image slides, most impactful feature gap
2. **Slide reordering** (drag in outline) — basic UX need
3. **Block resize + drag** (svelte-moveable) — core canvas editing
4. **chenglou/pretext text reflow** — fixes overflow, powers resize
5. **Multi-column layouts** — matches existing deck patterns
6. **Rendering quality improvements** — typography, fragments, section labels
7. **Bug fixes from v1 testing** — chat history, gallery refresh, etc.
8. **Export improvements** — images in zip, speaker notes, thumbnails
9. **Fragment/progressive disclosure** — editing + rendering
10. **Template forking** — agent-driven customization
11. **Staging deployment** — get it in front of the team
