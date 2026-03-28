# Slide Maker v1 — Design Spec

## Overview

A chat-driven slide builder for the CUNY AI Lab. Users converse with an AI agent to generate, edit, and compose presentation decks through a three-panel interface. The first build proves the end-to-end authoring loop: chat → structured slide mutations → live canvas preview → zip export.

**Primary users:** CUNY AI Lab team (Stefano, Zach, others) first, then broader CUNY faculty.

**First build scope:** Chat-driven workflow with Anthropic + OpenRouter, modular slide composition, template library seeded from existing repos, SQLite persistence, email/password auth with CUNY domain gating and admin approval.

---

## System Architecture

### Two Deployable Units

```
┌─────────────────────────┐     ┌──────────────────────────┐
│   SvelteKit Frontend    │     │      API Server           │
│                         │────▶│  (Hono on Node)           │
│  - Three-panel UI       │     │                           │
│  - Canvas rendering     │     │  - /api/chat (streaming)  │
│  - Slide state mgmt     │     │  - /api/auth/*            │
│  - Export (zip bundler)  │     │  - /api/decks/*           │
│  - Template library     │     │  - /api/admin/*           │
│                         │     │  - Provider routing:      │
│  Port: 5173 (dev)       │     │    · Anthropic (Claude)   │
│                         │     │    · OpenRouter            │
└─────────────────────────┘     │  - SQLite + Drizzle       │
                                │  - Lucia auth              │
                                │                           │
                                │  Port: 3001 (dev)          │
                                └──────────────────────────┘
```

### Why These Choices

- **SvelteKit:** The prompt doc specifies Svelte. SvelteKit gives us file-based routing, SSR capability, and a dev server out of the box.
- **Hono:** Lightweight, fast, first-class streaming support (SSE for chat), runs on Node. Easy to deploy behind Nginx. No framework overhead.
- **SQLite + Drizzle:** Single-file database, no server to run. Drizzle provides typed schema that mirrors the TypeScript data model. Trivial to migrate to Postgres later.
- **Lucia:** Lightweight session-based auth. Works with SQLite + Drizzle. Handles password hashing, session management, cookie handling without owning the whole stack.

### Monorepo Structure

```
slide-maker/
├── apps/
│   ├── web/                ← SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── chat/         ← Chat panel components
│   │   │   │   │   ├── outline/      ← Slide accordion outline
│   │   │   │   │   ├── canvas/       ← Slide canvas renderer
│   │   │   │   │   ├── resources/    ← Right panel tabs
│   │   │   │   │   └── auth/         ← Login/register forms
│   │   │   │   ├── stores/           ← Svelte stores (deck state, UI state)
│   │   │   │   ├── renderers/        ← Block type renderers (text, image, code, etc.)
│   │   │   │   └── utils/
│   │   │   ├── routes/
│   │   │   │   ├── +layout.svelte    ← Auth guard, three-panel shell
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── deck/[id]/        ← Main editor route
│   │   │   └── app.css               ← CUNY AI Lab brand tokens
│   │   └── package.json
│   └── api/                ← Hono API server
│       ├── src/
│       │   ├── routes/
│       │   │   ├── chat.ts           ← Chat endpoint (SSE streaming)
│       │   │   ├── auth.ts           ← Register, login, verify, logout
│       │   │   ├── decks.ts          ← CRUD for decks
│       │   │   └── admin.ts          ← User approval queue
│       │   ├── providers/
│       │   │   ├── anthropic.ts      ← Claude SDK wrapper
│       │   │   └── openrouter.ts     ← OpenRouter (OpenAI-compatible)
│       │   ├── db/
│       │   │   ├── schema.ts         ← Drizzle schema
│       │   │   └── index.ts          ← DB connection
│       │   ├── auth/
│       │   │   └── lucia.ts          ← Lucia config
│       │   └── prompts/
│       │       └── system.ts         ← System prompt builder
│       └── package.json
├── packages/
│   └── shared/             ← Shared types and constants
│       ├── src/
│       │   ├── types.ts              ← Deck, Slide, ContentBlock, etc.
│       │   └── block-types.ts        ← BlockType enum + data shape definitions
│       └── package.json
├── templates/              ← Seeded slide templates (JSON)
├── docs/
├── pnpm-workspace.yaml
└── package.json
```

### Deployment Path

- **Dev:** `pnpm dev` runs both apps on localhost (5173 + 3001)
- **Staging:** Debian server, Nginx reverse proxy at `tools.cuny.qzz.io/slide-maker`. GitHub-mirrored deploy via webhook or GitHub Actions on push to `main`.
- **Production (later):** Published decks hosted at `projects.ailab.gc.cuny.edu/[deck-slug]`

---

## UI Layout

### Three-Panel Interface

**Left Panel (280px) — Chat + Slide Outline**

Split vertically:

1. **Chat section (upper):** Primary interface to the AI agent.
   - Model selector dropdown in the header (e.g., "Claude 3.5 Sonnet ▾") — switches between providers/models.
   - Message history with user/agent bubbles.
   - Text input with Send button.
   - Context-aware: sends active slide ID, deck state, and available templates with each request.

2. **Slide outline (lower):** Vertical list of accordion-expandable slide cards.
   - Collapsed by default (`expanded=false`).
   - Toggling a card: (a) makes that slide active on the canvas, (b) reveals the slide's content block list.
   - Each content block shows its type and key properties, editable inline.
   - Supports: add/remove slides, add/remove/reorder blocks within a slide, drag to reorder slides.
   - "Add Slide" button with type selector (Title, Section Divider, Body, Resources).

**Center Panel (flex) — Canvas**

- Renders the active slide at presentation aspect ratio (16:9).
- Toolbar above: slide counter (← 1/N →), Grid toggle, Zoom control, Preview button, Export ZIP button.
- Editable blocks shown with dashed outlines on hover.
- For v1: inline text editing on click. Drag/resize deferred to v2 (when chenglou/pretext integration happens).
- Fragment preview toggle for progressive disclosure slides.

**Right Panel (240px) — Resource Tabs**

Four tabs:
- **Files:** Uploaded project assets (images, data files). Drag into slides or reference from chat.
- **Templates:** Template cards organized by slide type, with thumbnail previews. Click to apply to the active slide. Grouped: Title Slides, Body Slides, Section Dividers, Resources.
- **Artifacts:** Reusable JS visualization components (D3 maps, charts, animated diagrams). These back the `chart`, `map`, and `diagram` block types. Browsable and insertable.
- **Themes:** CSS theme presets. Click to apply deck-wide. Shows color swatches and font previews.

**Wiring:** All three panels are interconnected. The accordion outline drives what the canvas displays. Resource tabs feed content into the outline and canvas. The chat agent orchestrates across all three zones.

---

## Data Model

### Database Schema (SQLite + Drizzle)

```typescript
// ── Auth ──

users {
  id: text (primary key, CUID)
  email: text (unique, must match *.cuny.edu)
  name: text
  passwordHash: text
  emailVerified: boolean (default false)
  status: text ('pending' | 'approved' | 'rejected', default 'pending')
  role: text ('admin' | 'editor' | 'viewer', default 'editor')
  createdAt: integer (unix timestamp)
}

sessions {
  id: text (primary key)
  userId: text (foreign key → users.id)
  expiresAt: integer (unix timestamp)
}

email_verifications {
  id: text (primary key)
  userId: text (foreign key → users.id)
  token: text (unique)
  expiresAt: integer (unix timestamp)
}

// ── Decks ──

decks {
  id: text (primary key, CUID)
  name: text
  slug: text (unique)
  themeId: text (foreign key → themes.id, nullable)
  metadata: text (JSON — author, date, institution)
  createdBy: text (foreign key → users.id)
  createdAt: integer
  updatedAt: integer
}

deck_access {
  deckId: text (foreign key → decks.id)
  userId: text (foreign key → users.id)
  role: text ('owner' | 'editor' | 'viewer')
  primary key (deckId, userId)
}

slides {
  id: text (primary key, CUID)
  deckId: text (foreign key → decks.id)
  type: text ('title' | 'section-divider' | 'body' | 'resources')
  order: integer
  notes: text (nullable — speaker notes)
  fragments: boolean (default false)
  createdAt: integer
  updatedAt: integer
}

content_blocks {
  id: text (primary key, CUID)
  slideId: text (foreign key → slides.id)
  type: text (BlockType — 'text' | 'heading' | 'image' | 'code' | ...)
  data: text (JSON — type-specific payload)
  layout: text (JSON, nullable — {x, y, width, height})
  order: integer
}

// ── Resources ──

templates {
  id: text (primary key, CUID)
  name: text
  slideType: text ('title' | 'section-divider' | 'body' | 'resources')
  blocks: text (JSON — array of block definitions without IDs)
  thumbnail: text (nullable — base64 or path)
  builtIn: boolean (default false — true for seeded templates)
  createdBy: text (foreign key → users.id, nullable)
}

themes {
  id: text (primary key, CUID)
  name: text
  css: text (CSS custom properties + styles)
  fonts: text (JSON — {heading, body})
  colors: text (JSON — {primary, secondary, accent, bg})
  builtIn: boolean (default false)
  createdBy: text (foreign key → users.id, nullable)
}

artifacts {
  id: text (primary key, CUID)
  name: text
  description: text
  type: text ('chart' | 'map' | 'diagram' | 'widget')
  source: text (JS/HTML source code)
  config: text (JSON — configurable parameters)
  builtIn: boolean (default false)
  createdBy: text (foreign key → users.id, nullable)
}

uploaded_files {
  id: text (primary key, CUID)
  deckId: text (foreign key → decks.id)
  filename: text
  mimeType: text
  path: text (storage path on disk)
  uploadedBy: text (foreign key → users.id)
  createdAt: integer
}

// ── Chat History ──

chat_messages {
  id: text (primary key, CUID)
  deckId: text (foreign key → decks.id)
  role: text ('user' | 'assistant')
  content: text (message text)
  mutations: text (JSON, nullable — mutations emitted with this message)
  provider: text (which model/provider was used)
  createdAt: integer
}
```

### TypeScript Types (shared package)

```typescript
type BlockType =
  | 'text'          // markdown/rich text
  | 'heading'       // title, subtitle, section label
  | 'image'         // src + caption
  | 'code'          // language + content + copy-to-clipboard
  | 'quote'         // blockquote callout
  | 'steps'         // numbered procedure block
  | 'card-grid'     // array of cards (comparison, timeline)
  | 'chart'         // D3/chart config (artifact-backed)
  | 'map'           // GeoJSON/TopoJSON (artifact-backed)
  | 'diagram'       // process flow (artifact-backed)
  | 'embed'         // iframe/external resource

interface ContentBlock {
  id: string
  type: BlockType
  data: Record<string, any>
  layout?: { x: number; y: number; width: number; height: number }
  order: number
}
```

---

## Chat → Slide Workflow

### Request/Response Flow

1. User types a message in the chat panel.
2. SvelteKit sends `POST /api/chat` with:
   - `message` — the user's text
   - `deckId` — current deck
   - `activeSlideId` — which slide is live on canvas
   - `provider` — selected model/provider
   - `history` — recent conversation messages for context
3. The API server builds a system prompt from:
   - Current deck state (all slides, their blocks, the active slide)
   - Available templates and their block structures
   - Active theme
   - Instructions for emitting structured mutations
4. The API server routes to the selected provider (Anthropic SDK or OpenRouter's OpenAI-compatible API).
5. The response streams back as SSE with interleaved text and mutations:

```jsonl
{"type": "text", "content": "I've created a title slide with the workshop branding."}
{"type": "mutation", "action": "addSlide", "payload": {...}}
{"type": "text", "content": "Want me to adjust the subtitle?"}
```

6. The frontend parses the stream in real time:
   - `text` → appended to the chat as an agent bubble
   - `mutation` → applied to the deck state in the Svelte store → canvas re-renders

### Mutation Types

| Action | Payload | Effect |
|--------|---------|--------|
| `addSlide` | `{type, blocks, insertAfter?}` | Insert a new slide |
| `removeSlide` | `{slideId}` | Delete a slide |
| `updateBlock` | `{slideId, blockId, data}` | Modify a block's content |
| `addBlock` | `{slideId, block, insertAfter?}` | Add a block to a slide |
| `removeBlock` | `{slideId, blockId}` | Remove a block |
| `reorderSlides` | `{order: string[]}` | Reorder slide list |
| `reorderBlocks` | `{slideId, order: string[]}` | Reorder blocks within a slide |
| `applyTemplate` | `{slideId, templateId}` | Replace slide's blocks with template |
| `setTheme` | `{themeId}` | Change deck theme |
| `updateMetadata` | `{field, value}` | Update deck metadata |

### System Prompt Construction

The system prompt is built dynamically per request. It includes:

1. **Role definition:** "You are a slide authoring assistant for the CUNY AI Lab..."
2. **Current deck state:** Serialized JSON of all slides and blocks (compact)
3. **Active slide context:** Which slide the user is looking at
4. **Available templates:** List of template names, types, and block structures
5. **Active theme:** Current colors and fonts
6. **Mutation format instructions:** Exact JSON schema for each mutation type, with examples
7. **Constraints:** "Only emit mutations that are valid against the current deck state. Always include a text response explaining what you did."

The prompt is provider-agnostic — same format regardless of whether Claude or an OpenRouter model is responding.

---

## Auth & User Management

### Registration Flow

```
User visits /register
       │
       ▼
Form: name + email + password
  • Email validated client-side: must match *.cuny.edu
  • Email validated server-side: regex + DNS MX check
  • Password: minimum 8 characters
       │
       ▼
Account created with status: "pending", emailVerified: false
Verification email sent (token link)
       │
       ▼
User clicks verification link
  • Token validated, emailVerified set to true
  • User sees: "Email verified. An admin will review your account."
       │
       ▼
Admin dashboard (/admin/users)
  • Shows list of verified, pending users
  • Admin clicks Approve or Reject
  • Approved → status: "approved", user can log in
  • Rejected → status: "rejected", user sees rejection message
       │
       ▼
Approved user logs in → session created → redirected to deck list
```

### Key Details

- **CUNY domain gate:** Registration rejects any email not matching `^.+@.+\.cuny\.edu$`. Validated at form level and server-side.
- **Password hashing:** Argon2 via Lucia's built-in utilities.
- **Sessions:** HTTP-only secure cookies, managed by Lucia. 30-day expiry with rolling renewal.
- **Email sending:** Nodemailer with SMTP (configure for the lab's mail server or a transactional service like Resend).
- **First admin:** Seeded via a CLI command (`pnpm seed:admin --email admin@gc.cuny.edu`) that creates an approved admin user.
- **Roles:**
  - `admin` — approve/reject users, manage all decks, manage templates/themes/artifacts
  - `editor` — create and edit own decks, use all templates/themes/artifacts
  - `viewer` — read-only access to shared decks (for later)

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/register` | POST | none | Create account (*.cuny.edu only) |
| `/api/auth/verify` | GET | none | Email verification via token |
| `/api/auth/login` | POST | none | Email + password login |
| `/api/auth/logout` | POST | session | Destroy session |
| `/api/auth/me` | GET | session | Get current user |
| `/api/admin/users` | GET | admin | List pending/all users |
| `/api/admin/users/:id/approve` | POST | admin | Approve a user |
| `/api/admin/users/:id/reject` | POST | admin | Reject a user |

### Deck & Chat API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/decks` | GET | session | List user's decks |
| `/api/decks` | POST | session | Create a new deck |
| `/api/decks/:id` | GET | session | Get full deck (slides + blocks) |
| `/api/decks/:id` | PATCH | session | Update deck metadata/theme |
| `/api/decks/:id` | DELETE | session | Delete a deck |
| `/api/decks/:id/slides` | POST | session | Add a slide |
| `/api/decks/:id/slides/:slideId` | PATCH | session | Update a slide |
| `/api/decks/:id/slides/:slideId` | DELETE | session | Delete a slide |
| `/api/decks/:id/slides/reorder` | POST | session | Reorder slides |
| `/api/decks/:id/export` | POST | session | Export deck as zip |
| `/api/decks/:id/files` | POST | session | Upload a file |
| `/api/chat` | POST | session | Chat with AI agent (SSE stream) |
| `/api/chat/:deckId/history` | GET | session | Get chat history for a deck |
| `/api/providers` | GET | session | List available providers/models |

---

## Export

### Zip Export Flow

1. User clicks "Export ZIP" in the canvas toolbar.
2. Frontend sends `POST /api/decks/:id/export` to the API server.
3. API server:
   - Reads the full deck state from SQLite
   - Renders each slide to static HTML using the active theme's CSS and block renderers
   - Bundles: `index.html` (slide deck with navigation), `css/` (theme styles), `js/` (navigation engine, any artifact JS), `assets/` (uploaded images/files)
   - Compresses into a zip
4. Returns the zip as a download.

### Output Structure

```
ai-in-the-humanities/
├── index.html          ← Self-contained slide deck
├── css/
│   └── theme.css       ← Compiled theme
├── js/
│   ├── navigation.js   ← Custom slide engine (not Reveal.js — our own)
│   └── artifacts/      ← D3, chart code, etc.
├── assets/
│   ├── images/
│   └── data/           ← GeoJSON, CSVs, etc.
└── manifest.json       ← Deck metadata
```

The exported deck is fully self-contained — open `index.html` in a browser and present. No server required. This is what eventually gets deployed to `projects.ailab.gc.cuny.edu/[slug]`.

---

## Template Library — Seeded from Existing Repos

### Source Repos and Pattern Extraction

Templates are seeded by decomposing patterns from these repos into the `templates/` directory as JSON files:

| Repo | Key Patterns to Extract |
|------|------------------------|
| **knowledge-collections** | Multi-column text+screenshot layouts, process flow diagrams, card-based timelines, comparative example progressions with color-coded indicators, RAG-pipeline explainers |
| **system-prompting** | Step-by-step procedure blocks with copy-to-clipboard, iterative prompt-building exercises (vague→warmer→strong), blockquote callouts for definitions |
| **creative-coding** | Live code demo embeds, JS-heavy interactive slides, creative coding exercise structures |
| **wba-maps** | D3 choropleth maps with TopoJSON, hover tooltips, temporal navigation sliders, state-level data viz |
| **cali-brooklyn** | Newer `src/` convention, CLAUDE.md-managed deck patterns |
| **gen-dev-foundations** | Workshop content structures, generative development exercise flows |
| **vibe-coding-prototypes** | Prototype-driven workshop flows, live coding artifact patterns |
| **psn2026** | Conference presentation layouts, academic slide conventions |
| **calandra-slides** | Additional presentation patterns, diverse layout styles |

### Template Format

Each template is a JSON file:

```json
{
  "name": "Two Column Explainer",
  "slideType": "body",
  "blocks": [
    {"type": "heading", "data": {"text": "", "level": 2}},
    {"type": "text", "data": {"markdown": "", "column": "left"}},
    {"type": "image", "data": {"src": "", "caption": "", "column": "right"}}
  ],
  "thumbnail": "two-column-explainer.png"
}
```

### Starter Templates (v1 target: 12-16 templates)

**Title Slides (2-3):**
- Branded Hero — gradient background, centered title, logo top-left
- Minimal Light — white background, bottom branding bar
- Conference Talk — title, author, affiliation, date

**Section Dividers (2):**
- Full Bleed Label — section name large and centered, colored background
- Sidebar Label — section name left-aligned with decorative element

**Body Slides (6-8):**
- Two Column (text + image side panel)
- Card Grid (3-up comparison/feature layout)
- Step Procedure (numbered instruction blocks with copy-to-clipboard)
- Blockquote + Body (pull quote framing with supporting text)
- Code Walkthrough (code block + annotation)
- Interactive Viz (D3/chart container with data config)
- Process Flow (animated diagram with labeled nodes)
- Full Image (image with overlay caption)

**Resources Slides (2):**
- Link List — grouped links with descriptions
- Credits — attribution grid with logos/names

---

## Brand Identity

Pulled from the CUNY AI Lab website (`CUNY-AI-Lab-website` repo):

### Colors
- **Navy (hero/primary dark):** `#1D3A83`
- **Bright Blue (CTA/primary):** `#3B73E6`
- **Medium Blue (hover):** `#2A6FB8`
- **Teal (accent):** `#2FB8D6`
- **Gold (pop accent):** `#ffb81c`
- **Cream (warm background):** `#fffcd5`
- **Pearl (off-white):** `#f7f4eb`
- **Stone (text):** `#333333`

### Typography
- **Headings/Display:** Outfit (weights: 400–800)
- **Body:** Inter (weights: 400–700)
- **Fallback:** system-ui, sans-serif

### Patterns
- Glass morphism: `backdrop-blur` with semi-transparent backgrounds
- Rounded corners: `rounded-full` (buttons), `rounded-2xl` (cards)
- Subtle shadows with colored tints on hover
- Footer: dark stone background with partner logos at reduced opacity

### Logos
- Primary: `logo-horizontal.png`
- Partner logos in `/public/images/partners/`
- Favicon: `favicon.png` (16px, 32px variants)

The builder UI itself uses these brand tokens. The default theme for generated decks also uses this palette, with the ability to create alternate themes.

---

## What's Explicitly Deferred

These are in the vision doc but **not in this first build:**

- **On-screen drag/resize/rotate editing** (chenglou/pretext + interaction library integration) — v2
- **PreTeXtBook/pretext structured authoring layer** — v2
- **Snap-to-grid / snap-to-template alignment** — v2
- **Fragment/progressive disclosure editing** — v1 supports the flag, rendering deferred
- **CUNY SSO (Shibboleth/CAS)** — after institutional approval
- **Real-time collaborative editing** — future
- **Published deck hosting at projects.ailab.gc.cuny.edu** — future (export zip is the bridge)
- **Template forking via the agent** — v1 has templates; agent-driven forking is v2
- **Advanced admin dashboard** — v1 has user approval queue only

---

## Success Criteria

The first build is done when:

1. A user can register with a `*.cuny.edu` email, get approved by an admin, and log in
2. A logged-in user can create a new deck, select a theme, and use the chat to generate slides
3. The chat agent (Claude or OpenRouter model) can create slides, add/modify content blocks, and apply templates via structured mutations
4. Slides render live on the canvas as the agent streams responses
5. The user can manually edit text content inline on the canvas
6. The template library has 12-16 seeded templates extracted from existing repos
7. The user can export the deck as a self-contained zip
8. The whole thing runs locally via `pnpm dev` and deploys to `tools.cuny.qzz.io/slide-maker` behind Nginx
