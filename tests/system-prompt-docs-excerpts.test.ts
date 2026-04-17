import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../apps/api/src/prompts/system'

function flatten(opts: Parameters<typeof buildSystemPrompt>[0]): string {
  const { staticPrompt, dynamicContext } = buildSystemPrompt(opts)
  return `${staticPrompt}\n\n${dynamicContext}`
}

describe('buildSystemPrompt — document excerpts', () => {
  it('includes Uploaded Documents section with Markdown excerpts', () => {
    const prompt = flatten({
      deck: {
        id: 'deck-1',
        name: 'Test Deck',
        themeId: null,
        slides: [],
      },
      activeSlideId: null,
      templates: [],
      theme: null,
      files: [
        { id: 'img1', filename: 'photo.png', mimeType: 'image/png', url: '/api/decks/deck-1/files/img1' },
        { id: 'doc1', filename: 'paper.pdf', mimeType: 'application/pdf', url: '/api/decks/deck-1/files/doc1', excerpt: '# Title\nSome PDF text here.' },
        { id: 'doc2', filename: 'notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: '/api/decks/deck-1/files/doc2', excerpt: '## Notes\nBullet 1\nBullet 2' },
      ],
      artifacts: [],
      activeArtifacts: [],
    } as any)

    expect(prompt).toContain('## Uploaded Files')
    expect(prompt).toContain('photo.png')
    expect(prompt).toContain('## Uploaded Documents (text excerpts)')
    expect(prompt).toContain('### paper.pdf (application/pdf)')
    expect(prompt).toContain('Some PDF text here')
    expect(prompt).toContain('### notes.docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)')
    expect(prompt).toContain('Bullet 1')
  })
})
