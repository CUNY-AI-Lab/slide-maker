import { describe, it, expect } from 'vitest'
import { parseOutline } from '../apps/api/src/utils/outline-parser'

const FILE_ID = 'test-file-1'

describe('outline-parser', () => {
  it('returns empty array for empty input', () => {
    expect(parseOutline('', FILE_ID)).toEqual([])
    expect(parseOutline('   \n\n  ', FILE_ID)).toEqual([])
  })

  it('parses a single H1 as deckTitle', () => {
    const tree = parseOutline('# My Presentation', FILE_ID)
    expect(tree).toHaveLength(1)
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toBe('My Presentation')
    expect(tree[0].source.fileId).toBe(FILE_ID)
  })

  it('parses H2/H3 as section nodes', () => {
    const md = '## Section One\n### Subsection'
    const tree = parseOutline(md, FILE_ID)
    expect(tree).toHaveLength(2)
    expect(tree[0].kind).toBe('section')
    expect(tree[0].text).toBe('Section One')
    expect(tree[1].kind).toBe('section')
    expect(tree[1].text).toBe('Subsection')
  })

  it('nests bullets under the nearest section', () => {
    const md = '## Intro\n- Point A\n- Point B\n## Next\n- Point C'
    const tree = parseOutline(md, FILE_ID)
    expect(tree).toHaveLength(2)
    expect(tree[0].kind).toBe('section')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children[0].kind).toBe('bullet')
    expect(tree[0].children[0].text).toBe('Point A')
    expect(tree[0].children[1].text).toBe('Point B')
    expect(tree[1].children).toHaveLength(1)
    expect(tree[1].children[0].text).toBe('Point C')
  })

  it('handles numbered lists as bullets', () => {
    const md = '## Steps\n1. First\n2. Second\n3) Third'
    const tree = parseOutline(md, FILE_ID)
    expect(tree[0].children).toHaveLength(3)
    expect(tree[0].children.every(c => c.kind === 'bullet')).toBe(true)
    expect(tree[0].children[0].text).toBe('First')
    expect(tree[0].children[2].text).toBe('Third')
  })

  it('parses blockquotes', () => {
    const md = '## Quotes\n> To be or not to be\n> that is the question'
    const tree = parseOutline(md, FILE_ID)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].kind).toBe('quote')
    expect(tree[0].children[0].text).toBe('To be or not to be\nthat is the question')
  })

  it('parses figures/images', () => {
    const md = '## Visuals\n![Chart of results](https://example.com/chart.png)'
    const tree = parseOutline(md, FILE_ID)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].kind).toBe('figure')
    expect(tree[0].children[0].text).toBe('Chart of results')
  })

  it('parses notes', () => {
    const md = '## Closing\nNote: Remember to thank the audience'
    const tree = parseOutline(md, FILE_ID)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].kind).toBe('notes')
    expect(tree[0].children[0].text).toBe('Remember to thank the audience')
  })

  it('parses contiguous paragraphs as a single paragraph node', () => {
    const md = '## Body\nThis is the first line.\nThis continues the paragraph.'
    const tree = parseOutline(md, FILE_ID)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].kind).toBe('paragraph')
    expect(tree[0].children[0].text).toBe('This is the first line. This continues the paragraph.')
  })

  it('places top-level bullets at root when no section exists', () => {
    const md = '- Standalone point\n- Another point'
    const tree = parseOutline(md, FILE_ID)
    expect(tree).toHaveLength(2)
    expect(tree[0].kind).toBe('bullet')
    expect(tree[1].kind).toBe('bullet')
  })

  it('parses a mixed outline correctly', () => {
    const md = [
      '# AI in Education',
      '',
      '## Introduction',
      'AI is transforming how we teach.',
      '',
      '## Key Benefits',
      '- Personalized learning',
      '- Instant feedback',
      '- Scalable tutoring',
      '',
      '> Education is the most powerful weapon — Mandela',
      '',
      '## Visual Evidence',
      '![Student outcomes](outcomes.png)',
      '',
      '## Conclusion',
      'Note: Wrap up with Q&A',
    ].join('\n')

    const tree = parseOutline(md, FILE_ID)

    // Root nodes: deckTitle + 4 sections
    expect(tree).toHaveLength(5)
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toBe('AI in Education')

    // Introduction section with 1 paragraph
    expect(tree[1].kind).toBe('section')
    expect(tree[1].text).toBe('Introduction')
    expect(tree[1].children).toHaveLength(1)
    expect(tree[1].children[0].kind).toBe('paragraph')

    // Key Benefits section with 3 bullets + 1 quote
    expect(tree[2].kind).toBe('section')
    expect(tree[2].text).toBe('Key Benefits')
    expect(tree[2].children).toHaveLength(4)
    expect(tree[2].children.filter(c => c.kind === 'bullet')).toHaveLength(3)
    expect(tree[2].children[3].kind).toBe('quote')

    // Visual Evidence section with 1 figure
    expect(tree[3].kind).toBe('section')
    expect(tree[3].children).toHaveLength(1)
    expect(tree[3].children[0].kind).toBe('figure')

    // Conclusion section with 1 notes
    expect(tree[4].kind).toBe('section')
    expect(tree[4].children).toHaveLength(1)
    expect(tree[4].children[0].kind).toBe('notes')
  })

  it('source spans point to correct byte offsets', () => {
    const md = '# Title\n## Section'
    const tree = parseOutline(md, FILE_ID)
    expect(tree[0].source.start).toBe(0)
    expect(tree[0].source.end).toBe(7) // '# Title' is 7 chars
    expect(tree[1].source.start).toBe(8) // after newline
    expect(tree[1].source.end).toBe(18) // '## Section' is 10 chars, 8+10=18
  })

  it('every node has a unique id', () => {
    const md = '# T\n## S1\n- a\n- b\n## S2\n- c'
    const tree = parseOutline(md, FILE_ID)
    const ids = new Set<string>()
    function collect(nodes: typeof tree) {
      for (const n of nodes) {
        ids.add(n.id)
        collect(n.children)
      }
    }
    collect(tree)
    // Count total nodes: T(1) + S1(1) + a(1) + b(1) + S2(1) + c(1) = 6
    expect(ids.size).toBe(6)
  })

  it('handles asterisk and plus bullets', () => {
    const md = '* Star bullet\n+ Plus bullet'
    const tree = parseOutline(md, FILE_ID)
    expect(tree).toHaveLength(2)
    expect(tree[0].kind).toBe('bullet')
    expect(tree[1].kind).toBe('bullet')
  })
})
