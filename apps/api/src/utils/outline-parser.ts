import { createId } from '@paralleldrive/cuid2'
import type { OutlineNode, OutlineNodeKind } from '@slide-maker/shared'

/**
 * Parse normalized markdown into an OutlineNode[] tree.
 *
 * Rules:
 * - `# Heading` (level 1) → deckTitle
 * - `## Heading` / `### Heading` (level 2-3) → section
 * - `- item` / `* item` → bullet (children of nearest section)
 * - `> quote` → quote
 * - `![alt](url)` → figure
 * - Lines starting with "Note:" or "Notes:" → notes
 * - Contiguous paragraphs → paragraph
 *
 * Unknown structures become paragraph nodes — the AI planner handles ambiguity.
 */
export function parseOutline(markdown: string, fileId: string): OutlineNode[] {
  if (!markdown || !markdown.trim()) return []

  const lines = markdown.split('\n')
  const root: OutlineNode[] = []
  let currentSection: OutlineNode | null = null
  let offset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineStart = offset
    const lineEnd = offset + line.length
    offset = lineEnd + 1 // +1 for the newline

    const trimmed = line.trim()
    if (!trimmed) continue

    // Heading detection
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const kind: OutlineNodeKind = level === 1 ? 'deckTitle' : 'section'

      const node: OutlineNode = {
        id: createId(),
        kind,
        text,
        children: [],
        source: { fileId, start: lineStart, end: lineEnd },
      }

      if (kind === 'deckTitle') {
        root.push(node)
        currentSection = null
      } else {
        root.push(node)
        currentSection = node
      }
      continue
    }

    // Bullet detection
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (bulletMatch) {
      const node: OutlineNode = {
        id: createId(),
        kind: 'bullet',
        text: bulletMatch[1].trim(),
        children: [],
        source: { fileId, start: lineStart, end: lineEnd },
      }

      // Collect continuation bullets into a group
      if (currentSection) {
        currentSection.children.push(node)
      } else {
        root.push(node)
      }
      continue
    }

    // Numbered list detection (treat same as bullet)
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (numberedMatch) {
      const node: OutlineNode = {
        id: createId(),
        kind: 'bullet',
        text: numberedMatch[1].trim(),
        children: [],
        source: { fileId, start: lineStart, end: lineEnd },
      }

      if (currentSection) {
        currentSection.children.push(node)
      } else {
        root.push(node)
      }
      continue
    }

    // Blockquote detection
    if (trimmed.startsWith('>')) {
      // Collect consecutive blockquote lines
      const quoteLines: string[] = [trimmed.replace(/^>\s*/, '')]
      let quoteEnd = lineEnd
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        i++
        const nextLine = lines[i]
        quoteEnd = offset + nextLine.length
        offset = quoteEnd + 1
        quoteLines.push(nextLine.trim().replace(/^>\s*/, ''))
      }

      const node: OutlineNode = {
        id: createId(),
        kind: 'quote',
        text: quoteLines.join('\n'),
        children: [],
        source: { fileId, start: lineStart, end: quoteEnd },
      }

      if (currentSection) {
        currentSection.children.push(node)
      } else {
        root.push(node)
      }
      continue
    }

    // Figure/image detection
    const figureMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (figureMatch) {
      const node: OutlineNode = {
        id: createId(),
        kind: 'figure',
        text: figureMatch[1] || figureMatch[2],
        children: [],
        source: { fileId, start: lineStart, end: lineEnd },
      }

      if (currentSection) {
        currentSection.children.push(node)
      } else {
        root.push(node)
      }
      continue
    }

    // Notes detection
    if (/^notes?:/i.test(trimmed)) {
      const noteText = trimmed.replace(/^notes?:\s*/i, '')
      const node: OutlineNode = {
        id: createId(),
        kind: 'notes',
        text: noteText,
        children: [],
        source: { fileId, start: lineStart, end: lineEnd },
      }

      if (currentSection) {
        currentSection.children.push(node)
      } else {
        root.push(node)
      }
      continue
    }

    // Paragraph (default fallback)
    // Collect contiguous non-empty, non-special lines
    const paraLines: string[] = [trimmed]
    let paraEnd = lineEnd
    while (i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim()
      // Stop at blank lines, headings, bullets, quotes, images, notes
      if (
        !nextTrimmed ||
        /^#{1,3}\s/.test(nextTrimmed) ||
        /^[-*+]\s/.test(nextTrimmed) ||
        /^\d+[.)]\s/.test(nextTrimmed) ||
        nextTrimmed.startsWith('>') ||
        /^!\[/.test(nextTrimmed) ||
        /^notes?:/i.test(nextTrimmed)
      ) {
        break
      }
      i++
      const nextLine = lines[i]
      paraEnd = offset + nextLine.length
      offset = paraEnd + 1
      paraLines.push(nextTrimmed)
    }

    const node: OutlineNode = {
      id: createId(),
      kind: 'paragraph',
      text: paraLines.join(' '),
      children: [],
      source: { fileId, start: lineStart, end: paraEnd },
    }

    if (currentSection) {
      currentSection.children.push(node)
    } else {
      root.push(node)
    }
  }

  return root
}
