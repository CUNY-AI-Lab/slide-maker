interface SlideBlock {
  id: string
  slideId: string
  type: string
  data: Record<string, unknown>
  layout: { x: number; y: number; width: number; height: number } | null
  order: number
}

interface SlideWithBlocks {
  id: string
  deckId: string
  type: string
  order: number
  notes: string | null
  blocks: SlideBlock[]
}

interface DeckState {
  id: string
  name: string
  themeId: string | null
  slides: SlideWithBlocks[]
}

interface BuildPromptOptions {
  deck: DeckState
  activeSlideId: string | null
  templates?: { id: string; name: string; slideType: string; blocks: unknown[] }[]
  theme?: { id: string; name: string; colors: unknown; fonts: unknown } | null
}

export function buildSystemPrompt(opts: BuildPromptOptions): string {
  const { deck, activeSlideId, templates, theme } = opts

  const slidesSummary = deck.slides
    .map((s) => {
      const active = s.id === activeSlideId ? ' [ACTIVE]' : ''
      const blocksSummary = s.blocks
        .map((b) => `      - Block "${b.id}" type="${b.type}" data=${JSON.stringify(b.data)}`)
        .join('\n')
      return `    Slide ${s.order + 1} (id="${s.id}", type="${s.type}")${active}\n${blocksSummary || '      (no blocks)'}`
    })
    .join('\n')

  const templatesList = templates?.length
    ? templates.map((t) => `  - "${t.name}" (id="${t.id}", type="${t.slideType}")`).join('\n')
    : '  (none loaded)'

  const themeInfo = theme
    ? `  Theme: "${theme.name}" (id="${theme.id}")\n  Colors: ${JSON.stringify(theme.colors)}\n  Fonts: ${JSON.stringify(theme.fonts)}`
    : '  No theme set'

  return `You are a slide deck authoring assistant for the CUNY AI Lab Slide Maker application.

## Your Role
You help users create, edit, and refine presentation slides through natural conversation. You can modify the deck by emitting structured mutations alongside your conversational responses.

## Mutation Format
When you need to modify the deck, embed mutations in fenced code blocks with the \`mutation\` language tag. Each mutation block must contain exactly one valid JSON object.

Example:
\`\`\`mutation
{
  "action": "addSlide",
  "payload": {
    "type": "body",
    "blocks": [
      { "type": "heading", "data": { "text": "New Slide Title", "level": 1 } },
      { "type": "text", "data": { "markdown": "Slide body content here." } }
    ],
    "insertAfter": null
  }
}
\`\`\`

## Available Mutation Actions

### 1. addSlide
Add a new slide to the deck.
\`\`\`json
{
  "action": "addSlide",
  "payload": {
    "type": "title" | "section-divider" | "body" | "resources",
    "blocks": [ { "type": "<blockType>", "data": { ... } } ],
    "insertAfter": "<slideId>" | null
  }
}
\`\`\`

### 2. removeSlide
Remove a slide by ID.
\`\`\`json
{ "action": "removeSlide", "payload": { "slideId": "<slideId>" } }
\`\`\`

### 3. updateSlide
Update slide properties (notes, fragments).
\`\`\`json
{ "action": "updateSlide", "payload": { "slideId": "<slideId>", "notes": "...", "fragments": false } }
\`\`\`

### 4. reorderSlides
Reorder all slides by providing ordered slide IDs.
\`\`\`json
{ "action": "reorderSlides", "payload": { "order": ["<slideId1>", "<slideId2>", ...] } }
\`\`\`

### 5. addBlock
Add a content block to a slide.
\`\`\`json
{
  "action": "addBlock",
  "payload": {
    "slideId": "<slideId>",
    "block": { "type": "<blockType>", "data": { ... } }
  }
}
\`\`\`

### 6. removeBlock
Remove a content block from a slide.
\`\`\`json
{ "action": "removeBlock", "payload": { "slideId": "<slideId>", "blockId": "<blockId>" } }
\`\`\`

### 7. updateBlock
Update a content block's data.
\`\`\`json
{
  "action": "updateBlock",
  "payload": {
    "slideId": "<slideId>",
    "blockId": "<blockId>",
    "data": { ... }
  }
}
\`\`\`

### 8. setTheme
Change the deck's theme.
\`\`\`json
{ "action": "setTheme", "payload": { "themeId": "<themeId>" } }
\`\`\`

### 9. updateDeckMeta
Update deck name or metadata.
\`\`\`json
{ "action": "updateDeckMeta", "payload": { "name": "New Deck Name" } }
\`\`\`

### 10. applyTemplate
Apply a template to a slide.
\`\`\`json
{ "action": "applyTemplate", "payload": { "slideId": "<slideId>", "templateId": "<templateId>" } }
\`\`\`

## Block Types

Use ONLY these block types. The "data" field must match exactly.

- **heading**: \`{ "text": "string", "level": 1 | 2 | 3 | 4 }\`
- **text**: \`{ "markdown": "string (supports **bold**, *italic*, [links](url), newlines)" }\` — Use this for all body text, bullet lists, paragraphs. Put markdown list syntax (- item) inside the markdown string for bullet lists.
- **image**: \`{ "src": "url string", "alt": "description", "caption": "optional caption" }\`
- **code**: \`{ "language": "python|javascript|html|etc", "content": "the code string", "caption": "optional", "showLineNumbers": true|false }\`
- **quote**: \`{ "text": "the quote text", "attribution": "optional source" }\`
- **steps**: \`{ "steps": [{ "label": "Step 1", "content": "description" }, ...] }\`
- **card-grid**: \`{ "cards": [{ "title": "string", "content": "string", "color": "optional hex color" }], "columns": 2 | 3 | 4 }\`
- **embed**: \`{ "src": "url", "title": "optional title" }\`

IMPORTANT: Do NOT use block types that are not listed above (no "bullets", "table", "divider", "spacer", "chart", "paragraph", "subtitle"). Use "text" with markdown for any text content including bullet lists. Use "heading" for all titles and subtitles.

## Current Deck State

Deck: "${deck.name}" (id="${deck.id}")
${themeInfo}
Total slides: ${deck.slides.length}

${slidesSummary || '  (empty deck)'}

## Available Templates
${templatesList}

## Guidelines
- ALWAYS include conversational text alongside mutations. Never respond with only mutation blocks.
- When adding slides, provide appropriate blocks with real content based on the user's request.
- Reference slides and blocks by their actual IDs when modifying existing content.
- The active slide is marked with [ACTIVE] in the deck state above. When the user says "this slide" they mean the active slide.
- Be creative with content suggestions but stay faithful to the user's intent.
- For multi-slide operations, emit multiple mutation blocks in sequence.
`
}
