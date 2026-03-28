import { NAVIGATION_JS } from './navigation.js'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface Block {
  type: string
  data: Record<string, unknown>
  order: number
}

interface Slide {
  id: string
  type: string
  order: number
  fragments: boolean
  blocks: Block[]
}

interface Theme {
  name: string
  css: string
  fonts: unknown
  colors: unknown
}

function renderBlock(block: Block): string {
  const data = block.data || {}

  switch (block.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(data.level) || 1, 1), 4)
      const tag = `h${level}`
      const text = String(data.text || '')
      return `<${tag}>${escapeHtml(text)}</${tag}>`
    }

    case 'text': {
      const content = String(data.content || data.text || '')
      return `<div class="text-block">${escapeHtml(content)}</div>`
    }

    case 'image': {
      const src = String(data.src || data.url || '')
      const alt = String(data.alt || '')
      const caption = String(data.caption || '')
      let html = `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`
      if (caption) {
        html += `<figcaption>${escapeHtml(caption)}</figcaption>`
      }
      html += `</figure>`
      return html
    }

    case 'code': {
      const code = String(data.code || data.content || '')
      const language = String(data.language || '')
      return `<div class="code-wrapper"><pre><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">Copy</button></div>`
    }

    case 'quote': {
      const quote = String(data.quote || data.text || '')
      const cite = String(data.cite || data.author || '')
      let html = `<blockquote><p>${escapeHtml(quote)}</p>`
      if (cite) {
        html += `<cite>${escapeHtml(cite)}</cite>`
      }
      html += `</blockquote>`
      return html
    }

    case 'steps': {
      const items = Array.isArray(data.items) ? data.items : []
      const lis = items.map((item: unknown) => `<li>${escapeHtml(String(item))}</li>`).join('\n        ')
      return `<ol class="steps-block">\n        ${lis}\n      </ol>`
    }

    case 'card-grid': {
      const cards = Array.isArray(data.cards) ? data.cards : []
      const cardHtml = cards.map((card: Record<string, unknown>) => {
        const title = String(card.title || '')
        const body = String(card.body || card.content || '')
        return `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`
      }).join('\n        ')
      return `<div class="card-grid">\n        ${cardHtml}\n      </div>`
    }

    case 'embed': {
      const src = String(data.src || data.url || '')
      const title = String(data.title || 'Embedded content')
      return `<iframe src="${escapeHtml(src)}" title="${escapeHtml(title)}" frameborder="0" allowfullscreen loading="lazy" style="width:100%;height:400px;border-radius:8px;"></iframe>`
    }

    default:
      return `<div class="text-block">${escapeHtml(JSON.stringify(data))}</div>`
  }
}

function renderSlide(slide: Slide, index: number): string {
  const isFirst = index === 0
  const activeClass = isFirst ? ' active' : ''
  const ariaHidden = isFirst ? 'false' : 'true'
  const fragmentClass = slide.fragments ? ' fragmented' : ''
  const typeClass = slide.type === 'title' ? ' title-slide' : ''

  const blocksHtml = slide.blocks
    .sort((a, b) => a.order - b.order)
    .map((block) => {
      const fragmentAttr = slide.fragments ? ' class="fragment"' : ''
      return `      <div${fragmentAttr}>${renderBlock(block)}</div>`
    })
    .join('\n')

  return `    <section class="slide-section${activeClass}${typeClass}${fragmentClass}" aria-hidden="${ariaHidden}" data-slide-index="${index}">
${blocksHtml}
    </section>`
}

export function renderDeckHtml(
  deckName: string,
  slideList: Slide[],
  theme: Theme | null,
): string {
  const sortedSlides = [...slideList].sort((a, b) => a.order - b.order)
  const slidesHtml = sortedSlides.map((slide, i) => renderSlide(slide, i)).join('\n\n')
  const themeCss = theme?.css || ''
  const title = escapeHtml(deckName)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/theme.css" />
  <style>
${themeCss}
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to content</a>

  <main id="main-content">
${slidesHtml}
  </main>

  <nav class="slide-nav" aria-label="Slide navigation">
    <button id="prev-btn" aria-label="Previous slide">&larr;</button>
    <span id="slide-counter">1 / ${sortedSlides.length}</span>
    <button id="next-btn" aria-label="Next slide">&rarr;</button>
  </nav>

  <script>
${NAVIGATION_JS}
  </script>
</body>
</html>`
}
