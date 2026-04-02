# Artifact Upgrade: Frappe Charts + Native Timeline

**Date:** 2026-04-01
**Status:** Design approved, pending implementation

## Context

The slide-maker's artifact system currently has 16 built-in artifacts (4 HTML-source iframe, 12 native canvas). Charts are hand-rolled Canvas/SVG with no charting library — only bar and pie exist. The timeline is a ~3KB inline CSS/JS flex layout with no date awareness, no zoom, and no interactivity beyond hover.

This upgrade replaces the chart artifacts with Frappe Charts (a 17KB library) and rebuilds the timeline as a native SVG artifact with date-aware time-scaling, categories, and eras. The goal is richer data visualization with minimal bundle impact, leveraging the existing rendering pipeline and optimizing for AI config generation.

## Approach

**Frappe Charts** as a static library artifact (iframe path, following the Leaflet pattern) for 5 chart types. **Custom native timeline** (native path, like Boids/A*) with SVG rendering and theme integration. No new external dependencies beyond the single Frappe Charts JS file.

---

## 1. Frappe Charts Integration

### Static Files

Download `frappe-charts.min.umd.js` into `apps/api/static/`. Served via existing `/api/static/:file` route in `apps/api/src/index.ts`.

### Shared HTML Wrapper

A single ~40-line HTML template that all Frappe chart artifacts share:

```html
<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; overflow: hidden; }
    #chart { width: 100%; height: 100vh; }
  </style>
</head><body data-config="{}">
  <div id="chart"></div>
  <script src="/api/static/frappe-charts.min.umd.js"></script>
  <script>
    const cfg = JSON.parse(document.body.getAttribute('data-config') || '{}');
    const chart = new frappe.Chart('#chart', {
      ...cfg,
      animate: true,
      truncateLegends: true
    });
    new ResizeObserver(() => chart.draw()).observe(document.getElementById('chart'));
  </script>
</body></html>
```

### Seeded Artifact Templates

Create `templates/artifacts/` JSON files for each chart type:

| File | Name | Type | Config Defaults |
|------|------|------|----------------|
| `frappe-bar.json` | Bar Chart | chart | 7 labels, 1 dataset, blue palette |
| `frappe-line.json` | Line Chart | chart | 6 labels, 1 dataset, line options |
| `frappe-pie.json` | Pie Chart | chart | 5 segments, warm palette |
| `frappe-percentage.json` | Percentage Bar | chart | 4 categories, CUNY palette |
| `frappe-heatmap.json` | Heatmap | chart | 90-day sample, activity grid |

Each JSON file has the structure:
```json
{
  "id": "artifact-frappe-bar",
  "name": "Bar Chart",
  "description": "Interactive bar chart with hover tooltips and animation",
  "type": "chart",
  "source": "<the shared HTML wrapper>",
  "config": {
    "type": { "type": "select", "label": "Chart Type", "default": "bar", "options": ["bar", "line", "pie", "percentage"] },
    "data": {
      "type": "object",
      "label": "Data",
      "default": {
        "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "datasets": [{ "name": "Activity", "values": [18, 40, 30, 35, 8, 52, 17] }]
      }
    },
    "colors": { "type": "array", "label": "Colors", "default": ["#0ea5e9"] }
  }
}
```

### Deprecation of Inline Charts

The existing `artifact-bar-chart` and `artifact-pie-chart` (inline HTML in `seed.ts`) are superseded by the Frappe versions. Remove them from the seed. Existing decks referencing the old artifact IDs continue to render (the `rawSource` is stored in `content_blocks.data`, not resolved from the artifacts table at render time).

### Files Modified

- `apps/api/static/frappe-charts.min.umd.js` — new static file
- `templates/artifacts/frappe-bar.json` — new
- `templates/artifacts/frappe-line.json` — new
- `templates/artifacts/frappe-pie.json` — new
- `templates/artifacts/frappe-percentage.json` — new
- `templates/artifacts/frappe-heatmap.json` — new
- `apps/api/src/db/seed.ts` — remove inline bar/pie, load Frappe templates

---

## 2. Native Timeline Artifact

### New File

`apps/web/src/lib/modules/artifacts/timeline.ts` — implements `ArtifactFactory`.

### Config Schema

```ts
type TimelineEvent = {
  date: string        // "YYYY", "YYYY-MM", or "YYYY-MM-DD"
  label: string
  description?: string
  category?: string   // maps to categoryColors
}

type TimelineEra = {
  name: string
  start: string       // same date formats
  end: string
  color?: string      // hex color, default derived from theme
}

type TimelineConfig = {
  events: TimelineEvent[]
  eras?: TimelineEra[]
  orientation?: 'horizontal' | 'vertical'  // default: 'horizontal'
  style?: 'dots' | 'cards'                 // default: 'dots'
  categoryColors?: Record<string, string>   // e.g. { milestone: '#f59e0b' }
}
```

### Date Parsing

Supports three formats:
- `"1950"` → January 1, 1950
- `"2024-03"` → March 1, 2024
- `"2024-03-15"` → March 15, 2024

Events are positioned proportionally along the axis based on their date values. A 30-year gap renders wider than a 1-year gap.

### SVG Rendering

**Horizontal mode** (default):
- Timeline axis: horizontal line near bottom third
- Events: dots on the axis, labels + descriptions above/below (alternating to avoid overlap)
- Eras: semi-transparent colored rectangles spanning their date range behind the axis
- Category dots colored per `categoryColors`
- Legend if multiple categories

**Vertical mode**:
- Timeline axis: vertical line on left third
- Events extend rightward with connecting lines
- Same era/category support

**Interactivity**:
- Hover on event dot → tooltip with full label + description
- Touch-friendly hit targets

**Theme integration**:
- Reads CSS custom properties from the host container: `--navy`, `--teal`, `--blue`, `--stone`
- Falls back to hardcoded CUNY defaults if variables unavailable
- Auto-detects dark/light background for text contrast

### Backward Compatibility

The factory detects old-format config (`{ events: [{ label, desc }] }` without `date` field) and:
1. Maps `desc` → `description`
2. Renders events evenly spaced (no time-scaling) since no dates are available
3. Logs no warnings — just works

### Registration

```ts
registerArtifact('Timeline', createTimeline)
```

Added to `NATIVE_ARTIFACT_NAMES` in `apps/api/src/export/artifacts.ts`.

### Template JSON

`templates/artifacts/timeline.json`:
```json
{
  "id": "artifact-timeline",
  "name": "Timeline",
  "description": "Date-aware timeline with events, categories, and optional eras",
  "type": "diagram",
  "config": {
    "events": {
      "type": "array",
      "label": "Events",
      "itemShape": { "date": "string", "label": "string", "description": "string", "category": "string" },
      "default": [
        { "date": "1950", "label": "Turing Test", "description": "Alan Turing proposes the imitation game", "category": "milestone" },
        { "date": "1956", "label": "Dartmouth Conference", "description": "The field of AI is formally founded", "category": "milestone" },
        { "date": "1997", "label": "Deep Blue", "description": "IBM's computer defeats world chess champion", "category": "breakthrough" },
        { "date": "2012", "label": "AlexNet", "description": "Deep learning revolution in image recognition", "category": "breakthrough" },
        { "date": "2022-11", "label": "ChatGPT", "description": "Large language models reach mainstream adoption", "category": "release" }
      ]
    },
    "eras": {
      "type": "array",
      "label": "Eras",
      "itemShape": { "name": "string", "start": "string", "end": "string", "color": "string" },
      "default": []
    },
    "orientation": { "type": "select", "label": "Orientation", "default": "horizontal", "options": ["horizontal", "vertical"] },
    "style": { "type": "select", "label": "Style", "default": "dots", "options": ["dots", "cards"] },
    "categoryColors": {
      "type": "object",
      "label": "Category Colors",
      "default": { "milestone": "#f59e0b", "breakthrough": "#0ea5e9", "release": "#10b981" }
    }
  }
}
```

### Files Modified

- `apps/web/src/lib/modules/artifacts/timeline.ts` — new native factory
- `apps/web/src/lib/modules/artifacts/index.ts` — no change (self-registers on import)
- `apps/web/src/lib/components/renderers/ArtifactModule.svelte` — add import for `timeline.ts`
- `apps/api/src/export/artifacts.ts` — add ES5 re-implementation + add to `NATIVE_ARTIFACT_NAMES`
- `templates/artifacts/timeline.json` — new template
- `apps/api/src/db/seed.ts` — remove inline timeline, load from template

---

## 3. Export Pipeline: Static Library Bundling

### Problem

Iframe artifacts that reference `/api/static/` files (Frappe Charts, Leaflet) don't export correctly — the static files aren't in the ZIP and the paths don't resolve.

### Solution

Extend `apps/api/src/export/index.ts` post-extraction step:

1. After `getExtractedArtifacts()` returns the `Map<filename, source>`:
2. Scan each extracted HTML source for `/api/static/` references (regex: `/\/api\/static\/([^"']+)/g`)
3. Collect unique static file names into a `Set<string>`
4. For each static file:
   - Read from `apps/api/static/{filename}`
   - Add to ZIP as `{slug}/lib/{filename}`
5. Rewrite all `/api/static/{filename}` references in extracted HTML to `../lib/{filename}`

This also fixes Leaflet map export as a side effect.

### Files Modified

- `apps/api/src/export/index.ts` — add static file detection + bundling + path rewriting

---

## 4. System Prompt Updates

### Artifact Index (Tier 1)

Update `buildArtifactsSection()` in `apps/api/src/prompts/system.ts`:

```
| ID | Name | Description | Params |
| artifact-frappe-bar | Bar Chart | Interactive bar chart with tooltips | 3 params |
| artifact-frappe-line | Line Chart | Line chart with smooth curves | 3 params |
| artifact-frappe-pie | Pie Chart | Pie chart with percentages | 2 params |
| artifact-frappe-percentage | Percentage Bar | Horizontal stacked proportion bar | 2 params |
| artifact-frappe-heatmap | Heatmap | Calendar-style activity heatmap | 1 param |
| artifact-timeline | Timeline | Date-aware timeline with eras and categories | 5 params |
```

### Mutation Examples

Add chart config example to system prompt:
```json
{ "action": "addBlock", "payload": { "slideId": "...", "block": { "type": "artifact", "zone": "stage", "data": { "artifactName": "Line Chart", "config": { "data": { "labels": ["Jan","Feb","Mar"], "datasets": [{ "name": "Sales", "values": [120,180,150] }] }, "colors": ["#0ea5e9"] } } } } }
```

Add timeline config example:
```json
{ "action": "addBlock", "payload": { "slideId": "...", "block": { "type": "artifact", "zone": "stage", "data": { "artifactName": "Timeline", "config": { "events": [{ "date": "2024-01", "label": "Phase 1", "description": "Research begins" }] } } } } }
```

### Files Modified

- `apps/api/src/prompts/system.ts` — artifact index auto-generates from DB, but examples section needs manual update

---

## 5. Artifact Roadmap

### Delivered in This Spec

| Category | Before | After |
|----------|--------|-------|
| **Chart** | 2 inline (bar, pie) | 5 Frappe types (bar, line, pie, percentage, heatmap) |
| **Diagram** | 1 inline timeline (no dates) | Native SVG timeline (dates, eras, categories, themes) |
| **Map** | 1 Leaflet (broken export) | 1 Leaflet (export fixed by static bundling) |
| **Visualization** | 12 native canvas | 12 native canvas (unchanged) |

### Future Potential (Not in This Spec)

| Category | Potential Additions | Notes |
|----------|-------------------|-------|
| **Chart** | Donut, scatter, radar, area | Native artifacts (~150 lines each), no library needed |
| **Diagram** | Flowchart, org chart, mind map | Consider Mermaid.js or Dagre for layout engine |
| **Map** | Choropleth data overlays, marker clustering | Leaflet plugins, served from `/api/static/` |
| **Visualization** | User-uploadable custom artifacts | Security sandbox review needed |
| **Cross-cutting** | Config UI (sliders/inputs vs JSON textarea) | Major UX improvement, separate spec |
| **Cross-cutting** | AI-generated custom artifacts | LLM writes artifact HTML from description |

---

## Verification Plan

### Frappe Charts

1. Seed the new Frappe chart artifacts: `pnpm db:seed`
2. Open the app, navigate to Artifacts tab — verify 5 new chart types appear under "chart" group
3. Insert each chart type into a slide — verify it renders in iframe with default data
4. Edit config JSON in ArtifactsTab — verify chart updates with custom data
5. Ask AI in chat to "add a line chart showing quarterly revenue" — verify valid mutation
6. Export deck to ZIP — verify `lib/frappe-charts.min.umd.js` exists and charts render in exported HTML

### Native Timeline

1. Insert Timeline artifact from Artifacts tab — verify SVG renders with default AI history events
2. Edit config to add custom events with dates — verify time-scaled positioning
3. Add eras to config — verify colored background spans
4. Switch orientation to vertical — verify layout change
5. Test backward compat: create a block with old-format config `{ events: [{ label: "Q1", desc: "Test" }] }` — verify it renders evenly spaced
6. Export deck — verify timeline renders in exported HTML via `artifacts.js` bundle

### Export Pipeline

1. Create a deck with both a Frappe chart and the native timeline
2. Export to ZIP
3. Open `index.html` in a browser (no server) — verify both chart and timeline render
4. Inspect ZIP contents: `lib/frappe-charts.min.umd.js` exists, `artifacts/*.html` has rewritten paths, `js/artifacts.js` includes timeline factory

### AI Integration

1. Start a new chat, ask AI to "create a bar chart comparing enrollment across 5 departments"
2. Verify the mutation uses `artifactName: "Bar Chart"` with valid Frappe config
3. Ask AI to "add a timeline of the project milestones from 2024 to 2026"
4. Verify the mutation uses `artifactName: "Timeline"` with dated events
