import fs from 'node:fs'

// Best-effort extraction of Markdown from supported document types.
// Uses optional dependencies: pdf-parse, mammoth, turndown.
// If a dependency is missing, returns null gracefully.

export async function extractMarkdownFromFile(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      // Lazy import to avoid loading when not needed
      let pdfParse: any
      try {
        pdfParse = (await import('pdf-parse')).default
      } catch {
        return null
      }
      const dataBuffer = fs.readFileSync(filePath)
      const data = await pdfParse(dataBuffer)
      const text = typeof data?.text === 'string' ? data.text : ''
      if (!text.trim()) return null
      // Normalize whitespace a bit for Markdown
      const normalized = text
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      return normalized
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      let mammoth: any
      let TurndownService: any
      try {
        mammoth = (await import('mammoth')).default ?? (await import('mammoth'))
        ;({ default: TurndownService } = await import('turndown'))
      } catch {
        return null
      }
      // Convert DOCX to HTML (mammoth), then HTML to Markdown (turndown)
      const result = await mammoth.convertToHtml({ path: filePath })
      const html: string = result?.value ?? ''
      if (!html.trim()) return null
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
      const md = td.turndown(html)
      return md.trim() || null
    }
  } catch (err) {
    console.warn('extractMarkdownFromFile error:', (err as Error)?.message)
    return null
  }
  return null
}

