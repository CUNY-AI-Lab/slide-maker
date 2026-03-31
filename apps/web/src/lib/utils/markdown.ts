import DOMPurify from 'dompurify'

export function inlineMarkdown(text: string): string {
  let html = text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safe = /^https?:\/\//i.test(url) ? url : '#'
    return `<a href="${safe}" target="_blank" rel="noopener">${label}</a>`
  })
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  return html
}

export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  let listType = ''

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+(.+)/)
    const numberedMatch = line.match(/^\d+\.\s+(.+)/)

    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
        out.push('<ul>')
        inList = true
        listType = 'ul'
      }
      out.push(`<li>${inlineMarkdown(bulletMatch[1])}</li>`)
    } else if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
        out.push('<ol>')
        inList = true
        listType = 'ol'
      }
      out.push(`<li>${inlineMarkdown(numberedMatch[1])}</li>`)
    } else {
      if (inList) {
        out.push(listType === 'ol' ? '</ol>' : '</ul>')
        inList = false
        listType = ''
      }
      if (line.trim() === '') {
        out.push('<br>')
      } else {
        out.push(`<p>${inlineMarkdown(line)}</p>`)
      }
    }
  }
  if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')

  return out.join('\n')
}

/** Convert markdown string to sanitized HTML, or pass through existing HTML */
export function renderContent(content: string): string {
  if (!content) return ''
  // If content already has HTML tags, sanitize and return as-is
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return DOMPurify.sanitize(content)
  }
  // Otherwise treat as markdown
  return DOMPurify.sanitize(markdownToHtml(content))
}
