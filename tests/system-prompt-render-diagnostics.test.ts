import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../apps/api/src/prompts/system'

function flatten(opts: Parameters<typeof buildSystemPrompt>[0]): string {
  const { staticPrompt, dynamicContext } = buildSystemPrompt(opts)
  return `${staticPrompt}\n\n${dynamicContext}`
}

describe('buildSystemPrompt render diagnostics', () => {
  it('includes available artifacts and recent canvas render issues', () => {
    const prompt = flatten({
      deck: {
        id: 'deck-1',
        name: 'Render Debug Deck',
        themeId: null,
        slides: [
          {
            id: 'slide-1',
            deckId: 'deck-1',
            layout: 'layout-content',
            order: 0,
            splitRatio: '0.45',
            notes: null,
            blocks: [
              {
                id: 'block-1',
                slideId: 'slide-1',
                type: 'artifact',
                zone: 'main',
                data: { registryId: 'artifact-timeline', config: { events: [] } },
                order: 0,
                stepOrder: null,
              },
            ],
          },
        ],
      },
      activeSlideId: 'slide-1',
      templates: [],
      artifacts: [
        {
          id: 'artifact-timeline',
          name: 'Timeline',
          type: 'diagram',
          config: {
            events: { type: 'array', default: [] },
          },
        },
      ],
      renderDiagnostics: [
        {
          moduleId: 'block-1',
          slideId: 'slide-1',
          moduleType: 'artifact',
          surface: 'preview',
          status: 'error',
          message: 'Artifact timed out in preview',
        },
      ],
      files: [],
      theme: null,
    })

    expect(prompt).toContain('## Available Artifacts')
    expect(prompt).toContain('artifact-timeline')
    expect(prompt).toContain('Timeline')
    expect(prompt).toContain('## Recent Canvas Render Issues')
    expect(prompt).toContain('Artifact timed out in preview')
    expect(prompt).toContain('registryId')
    expect(prompt).toContain('events: [{date, label, description, category?}]')
  })
})
