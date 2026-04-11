import type { OutlineNode, FidelityMode } from '@slide-maker/shared'

interface PlannerPromptOptions {
  deckName: string
  deckId: string
  sourceMarkdown: string
  outlineTree: OutlineNode[]
  slideBudget: { min: number; max: number }
  fidelity: FidelityMode
  templates: { id: string; name: string; layout: string; modules: unknown[] }[]
  theme?: { id: string; name: string; colors: unknown; fonts: unknown } | null
  existingSlideCount: number
  maxSlides: number
}

function serializeOutlineTree(nodes: OutlineNode[], depth = 0): string {
  const indent = '  '.repeat(depth)
  return nodes.map(n => {
    const childStr = n.children.length
      ? '\n' + serializeOutlineTree(n.children, depth + 1)
      : ''
    return `${indent}- [${n.kind}] id="${n.id}": ${n.text.slice(0, 200)}${n.text.length > 200 ? '…' : ''}${childStr}`
  }).join('\n')
}

const FIDELITY_INSTRUCTIONS: Record<FidelityMode, string> = {
  strict: `STRICT fidelity: Preserve section order, exact headings, quoted language, names, dates, formulas, and any locked nodes verbatim. Split slides when density forces it, but do NOT paraphrase unless overflow demands it. Every source node must appear on a slide or in slide notes — omit nothing unless structurally impossible.`,
  balanced: `BALANCED fidelity: Preserve claims, sequence, and terminology, but allow compression. Combine thin sections, tighten phrasing, merge closely related bullets. Maintain the author's argument structure and key terms.`,
  interpretive: `INTERPRETIVE fidelity: Rewrite freely for visual impact and presentation flow. Restructure sections, create new groupings, use concise slide-friendly phrasing. Preserve core claims and data but optimize for audience engagement.`,
}

export function buildPlannerPrompt(opts: PlannerPromptOptions): string {
  const {
    deckName, deckId, sourceMarkdown, outlineTree, slideBudget,
    fidelity, templates, theme, existingSlideCount, maxSlides,
  } = opts

  const availableSlots = maxSlides - existingSlideCount
  const templatesList = templates.length
    ? templates.map(t => {
        const modSummary = ((t.modules ?? []) as any[]).map((m: any) => `${m.type}(${m.zone})`).join(', ')
        return `  - "${t.name}" (id="${t.id}", layout="${t.layout}") → [${modSummary}]`
      }).join('\n')
    : '  (none loaded)'

  const themeInfo = theme
    ? `Theme: "${theme.name}" (id="${theme.id}")`
    : 'No theme set'

  return `You are a slide deck planner for the CUNY AI Lab Slide Wiz. Your job is to analyze a source document and produce a structured deck plan as JSON.

## Task
Analyze the source document below and produce a DeckPlan JSON object. The plan maps source content to slides with specific layouts, modules, and zone placements.

## Constraints
- Target slide count: ${slideBudget.min}–${slideBudget.max} slides (user-approved range)
- Maximum available slots: ${availableSlots} (deck already has ${existingSlideCount} slides, max ${maxSlides})
- ${FIDELITY_INSTRUCTIONS[fidelity]}

## Slide Layouts (7 types)
| Layout | Zones | Use |
|--------|-------|-----|
| \`title-slide\` | \`hero\` | Deck title + subtitle |
| \`layout-split\` | \`content\` (left), \`stage\` (right) | Most content slides (~70%) |
| \`layout-content\` | \`main\` | Full-width single column |
| \`layout-grid\` | \`main\` | Card grids |
| \`layout-full-dark\` | \`main\` | Section overviews, roadmaps |
| \`layout-divider\` | \`hero\` | Section breaks between parts |
| \`closing-slide\` | \`hero\` | Final slide |

## Module Types (14 types)
- **heading**: \`{ "text": "string", "level": 1|2|3|4 }\`
- **text**: \`{ "markdown": "string" }\`
- **label**: \`{ "text": "string", "color": "cyan"|"blue"|"navy"|"red"|"amber"|"green" }\`
- **stream-list**: \`{ "items": ["string", ...] }\`
- **card**: \`{ "content": "string", "variant": "cyan"|"navy"|"default" }\`
- **tip-box**: \`{ "content": "string", "title": "optional" }\`
- **prompt-block**: \`{ "content": "string", "quality": "good"|"mid"|"bad" }\`
- **image**: \`{ "src": "placeholder", "alt": "description" }\` (images resolved later)
- **carousel**: \`{ "items": [{"src": "placeholder", "caption": "optional"}] }\`
- **comparison**: \`{ "panels": [{"title": "string", "content": "string"}] }\`
- **card-grid**: \`{ "cards": [{"title": "string", "content": "string"}], "columns": 2|3|4 }\`
- **flow**: \`{ "nodes": [{"label": "string", "description": "optional"}] }\`
- **video**: \`{ "url": "string", "caption": "optional" }\`
- **artifact**: \`{ "registryId": "id", "config": {}, "alt": "description" }\`

Every module MUST have a \`zone\` field matching the layout's zones.

## Zone Quick Lookup
\`\`\`
title-slide    → hero
layout-split   → content (left text), stage (right visuals)
layout-content → main
layout-grid    → main
layout-full-dark → main
layout-divider → hero
closing-slide  → hero
\`\`\`

## Available Templates
${templatesList}

## ${themeInfo}

## Source Document Outline (structured)
${serializeOutlineTree(outlineTree)}

## Full Source Text
${sourceMarkdown}

## Output Format
Respond with ONLY a valid JSON object matching this schema. No prose, no markdown fences, just raw JSON:

{
  "slides": [
    {
      "planId": "unique-string",
      "sourceNodeIds": ["outline-node-id", ...],
      "purpose": "title"|"divider"|"content"|"quote"|"visual"|"closing",
      "layout": "layout-name",
      "title": "Slide title text",
      "fidelity": "${fidelity}",
      "modules": [
        { "type": "module-type", "zone": "zone-name", "data": { ... } }
      ],
      "notes": "optional speaker notes"
    }
  ],
  "omissions": [
    { "nodeId": "outline-node-id", "reason": "why this content was excluded" }
  ]
}

## Planning Rules
1. Start with a title slide using the deck title from the outline.
2. Use \`layout-divider\` for section breaks between major sections.
3. Prefer \`layout-split\` for content slides. Put text modules in \`content\` zone, visual placeholders in \`stage\` zone.
4. Group 3-5 related bullets into one slide using \`stream-list\` or individual \`card\` modules.
5. Quotes deserve their own slide or a \`tip-box\` within a content slide.
6. Figures become image placeholders on visual slides.
7. End with a \`closing-slide\` if the outline has a conclusion.
8. Every outline node must map to at least one slide (via \`sourceNodeIds\`) or appear in \`omissions\` with a reason.
9. Stay within the target slide count range.
10. For image modules, use \`"src": "placeholder"\` — actual images are resolved after planning.
11. Speaker notes from the outline go in the \`notes\` field, not as visible modules.
`
}
