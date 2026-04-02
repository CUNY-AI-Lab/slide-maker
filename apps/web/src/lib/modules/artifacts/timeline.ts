import type { ArtifactController, ArtifactFactory } from './index'

type TimelineEvent = {
  date?: string
  label: string
  description?: string
  desc?: string // backward compat
  category?: string
}

type TimelineEra = {
  name: string
  start: string
  end: string
  color?: string
}

type TimelineConfig = Partial<{
  events: TimelineEvent[]
  eras: TimelineEra[]
  orientation: 'horizontal' | 'vertical'
  style: 'dots' | 'cards'
  categoryColors: Record<string, string>
}>

// --- Date parsing ---

function parseDate(s: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s).getTime()
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(s + '-01').getTime()
  if (/^\d{4}$/.test(s)) return new Date(s + '-01-01').getTime()
  return NaN
}

function formatDate(s: string): string {
  if (/^\d{4}$/.test(s)) return s
  if (/^\d{4}-\d{2}$/.test(s)) {
    const d = new Date(s + '-01')
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// --- Theme color helpers ---

const DEFAULT_COLORS: Record<string, string> = {
  axis: '#334155',
  dot: '#3b82f6',
  text: '#e2e8f0',
  muted: '#94a3b8',
  bg: '#0d1117',
}

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  milestone: '#f59e0b',
  breakthrough: '#0ea5e9',
  release: '#10b981',
  event: '#6366f1',
  default: '#3b82f6',
}

function getThemeColor(root: HTMLElement, varName: string, fallback: string): string {
  const v = getComputedStyle(root).getPropertyValue(varName).trim()
  return v || fallback
}

// --- SVG helpers ---

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

// --- Main factory ---

export const createTimeline: ArtifactFactory = (root: HTMLElement, initialConfig: TimelineConfig = {}) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.display = 'block'
  svg.style.width = '100%'
  svg.style.height = '100%'
  root.appendChild(svg)

  let tooltip: HTMLDivElement | null = null
  let config: TimelineConfig = { ...initialConfig }

  function normalizeEvents(events: TimelineEvent[]): { label: string; description: string; date: number | null; dateStr: string; category: string }[] {
    return events.map(ev => ({
      label: ev.label,
      description: ev.description || ev.desc || '',
      date: ev.date ? parseDate(ev.date) : null,
      dateStr: ev.date || '',
      category: ev.category || 'default',
    }))
  }

  function getColor(category: string, catColors: Record<string, string>): string {
    return catColors[category] || DEFAULT_CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLORS.default
  }

  function showTooltip(x: number, y: number, label: string, desc: string) {
    if (!tooltip) {
      tooltip = document.createElement('div')
      tooltip.style.cssText = 'position:absolute;pointer-events:none;background:rgba(15,23,42,0.95);color:#e2e8f0;padding:6px 10px;border-radius:6px;font:12px Inter,system-ui,sans-serif;max-width:220px;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity 0.15s;white-space:normal;line-height:1.4'
      root.style.position = 'relative'
      root.appendChild(tooltip)
    }
    const b = document.createElement('b')
    b.textContent = label
    b.style.display = 'block'
    b.style.marginBottom = '2px'
    tooltip.replaceChildren(b)
    if (desc) {
      const span = document.createElement('span')
      span.textContent = desc
      span.style.color = '#94a3b8'
      tooltip.appendChild(span)
    }
    tooltip.style.opacity = '1'
    // Position relative to root
    const rootRect = root.getBoundingClientRect()
    tooltip.style.left = Math.min(x, rootRect.width - 230) + 'px'
    tooltip.style.top = (y - 50) + 'px'
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.opacity = '0'
  }

  function renderHorizontal(W: number, H: number) {
    svg.replaceChildren()
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)

    const events = normalizeEvents(config.events || [])
    if (events.length === 0) return

    const eras = config.eras || []
    const catColors = { ...DEFAULT_CATEGORY_COLORS, ...config.categoryColors }
    const isCards = config.style === 'cards'
    const axisColor = getThemeColor(root, '--slide-accent', DEFAULT_COLORS.axis)
    const textColor = getThemeColor(root, '--slide-text', DEFAULT_COLORS.text)
    const mutedColor = DEFAULT_COLORS.muted

    const pad = { left: 40, right: 40, top: 30, bottom: 50 }
    const axisY = H * 0.55
    const lineW = W - pad.left - pad.right

    // Determine if date-scaled or evenly spaced
    const hasDates = events.every(e => e.date !== null && !isNaN(e.date!))
    let positions: number[]

    if (hasDates) {
      const dates = events.map(e => e.date!)
      const minD = Math.min(...dates)
      const maxD = Math.max(...dates)
      const range = maxD - minD
      if (range > 0) {
        positions = dates.map(d => pad.left + ((d - minD) / range) * lineW)
      } else {
        // All dates identical — fall back to evenly spaced
        positions = events.map((_, i) => pad.left + (events.length === 1 ? lineW / 2 : (i / (events.length - 1)) * lineW))
      }
    } else {
      positions = events.map((_, i) => pad.left + (events.length === 1 ? lineW / 2 : (i / (events.length - 1)) * lineW))
    }

    // Draw eras (background spans)
    if (hasDates && eras.length > 0) {
      const dates = events.map(e => e.date!)
      const minD = Math.min(...dates)
      const maxD = Math.max(...dates)
      const range = maxD - minD || 1

      for (const era of eras) {
        const startMs = parseDate(era.start)
        const endMs = parseDate(era.end)
        if (isNaN(startMs) || isNaN(endMs)) continue

        const x1 = pad.left + ((startMs - minD) / range) * lineW
        const x2 = pad.left + ((endMs - minD) / range) * lineW
        const color = era.color || '#3b82f6'

        const rect = svgEl('rect', {
          x: Math.max(pad.left, x1),
          y: pad.top - 10,
          width: Math.min(x2, W - pad.right) - Math.max(pad.left, x1),
          height: H - pad.top - pad.bottom + 20,
          rx: 4,
          fill: color,
          opacity: 0.08,
        })
        svg.appendChild(rect)

        // Era label
        const midX = (Math.max(pad.left, x1) + Math.min(x2, W - pad.right)) / 2
        const eraLabel = svgEl('text', {
          x: midX,
          y: pad.top - 2,
          'text-anchor': 'middle',
          fill: color,
          'font-size': 10,
          'font-weight': 600,
          opacity: 0.6,
        })
        eraLabel.textContent = era.name
        svg.appendChild(eraLabel)
      }
    }

    // Draw axis line
    svg.appendChild(svgEl('line', {
      x1: pad.left, y1: axisY, x2: W - pad.right, y2: axisY,
      stroke: axisColor, 'stroke-width': 2, opacity: 0.3,
    }))

    // Draw events
    events.forEach((ev, i) => {
      const x = positions[i]
      const color = getColor(ev.category, catColors)
      const above = i % 2 === 0

      // Connecting line
      const lineTop = above ? axisY - 30 : axisY + 30
      svg.appendChild(svgEl('line', {
        x1: x, y1: axisY, x2: x, y2: lineTop,
        stroke: color, 'stroke-width': 1.5, opacity: 0.3,
      }))

      // Dot
      const dot = svgEl('circle', {
        cx: x, cy: axisY, r: 6,
        fill: color, stroke: 'rgba(0,0,0,0.3)', 'stroke-width': 2,
      })
      dot.style.cursor = 'pointer'
      dot.style.transition = 'r 0.15s'
      dot.addEventListener('mouseenter', () => {
        dot.setAttribute('r', '9')
        showTooltip(x, above ? axisY - 60 : axisY - 10, ev.label, ev.description)
      })
      dot.addEventListener('mouseleave', () => {
        dot.setAttribute('r', '6')
        hideTooltip()
      })
      svg.appendChild(dot)

      if (isCards) {
        // Card style
        const cardY = above ? axisY - 90 : axisY + 35
        const cardW = 120
        const cardH = 50
        const cardX = x - cardW / 2

        const card = svgEl('rect', {
          x: cardX, y: cardY, width: cardW, height: cardH,
          rx: 6, fill: 'rgba(30,41,59,0.6)', stroke: color, 'stroke-width': 1, opacity: 0.9,
        })
        svg.appendChild(card)

        const title = svgEl('text', {
          x, y: cardY + 18, 'text-anchor': 'middle',
          fill: textColor, 'font-size': 11, 'font-weight': 600,
        })
        title.textContent = ev.label
        svg.appendChild(title)

        if (ev.description) {
          const desc = svgEl('text', {
            x, y: cardY + 34, 'text-anchor': 'middle',
            fill: mutedColor, 'font-size': 9,
          })
          desc.textContent = ev.description.length > 25 ? ev.description.slice(0, 22) + '...' : ev.description
          svg.appendChild(desc)
        }
      } else {
        // Dot style: label + date
        const labelY = above ? axisY - 38 : axisY + 48
        const dateY = above ? axisY - 52 : axisY + 62

        const label = svgEl('text', {
          x, y: labelY, 'text-anchor': 'middle',
          fill: textColor, 'font-size': 11, 'font-weight': 600,
        })
        label.textContent = ev.label
        svg.appendChild(label)

        if (ev.dateStr) {
          const dateLabel = svgEl('text', {
            x, y: dateY, 'text-anchor': 'middle',
            fill: mutedColor, 'font-size': 9,
          })
          dateLabel.textContent = formatDate(ev.dateStr)
          svg.appendChild(dateLabel)
        }
      }
    })

    // Legend (if multiple categories)
    const categories = [...new Set(events.map(e => e.category))]
    if (categories.length > 1) {
      let lx = pad.left
      const ly = H - 12
      for (const cat of categories) {
        const color = getColor(cat, catColors)
        svg.appendChild(svgEl('circle', { cx: lx + 5, cy: ly - 3, r: 4, fill: color }))
        const t = svgEl('text', {
          x: lx + 14, y: ly, fill: mutedColor, 'font-size': 10,
        })
        t.textContent = cat
        svg.appendChild(t)
        lx += cat.length * 7 + 28
      }
    }
  }

  function renderVertical(W: number, H: number) {
    svg.replaceChildren()
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)

    const events = normalizeEvents(config.events || [])
    if (events.length === 0) return

    const catColors = { ...DEFAULT_CATEGORY_COLORS, ...config.categoryColors }
    const axisColor = getThemeColor(root, '--slide-accent', DEFAULT_COLORS.axis)
    const textColor = getThemeColor(root, '--slide-text', DEFAULT_COLORS.text)
    const mutedColor = DEFAULT_COLORS.muted

    const pad = { left: 30, right: 30, top: 30, bottom: 30 }
    const axisX = W * 0.2
    const lineH = H - pad.top - pad.bottom

    const hasDates = events.every(e => e.date !== null && !isNaN(e.date!))
    let positions: number[]

    if (hasDates) {
      const dates = events.map(e => e.date!)
      const minD = Math.min(...dates)
      const maxD = Math.max(...dates)
      const range = maxD - minD
      if (range > 0) {
        positions = dates.map(d => pad.top + ((d - minD) / range) * lineH)
      } else {
        positions = events.map((_, i) => pad.top + (events.length === 1 ? lineH / 2 : (i / (events.length - 1)) * lineH))
      }
    } else {
      positions = events.map((_, i) => pad.top + (events.length === 1 ? lineH / 2 : (i / (events.length - 1)) * lineH))
    }

    // Eras (horizontal bands behind axis)
    const eras = config.eras || []
    if (hasDates && eras.length > 0) {
      const dates = events.map(e => e.date!)
      const minD = Math.min(...dates)
      const maxD = Math.max(...dates)
      const eraRange = maxD - minD || 1
      for (const era of eras) {
        const startMs = parseDate(era.start)
        const endMs = parseDate(era.end)
        if (isNaN(startMs) || isNaN(endMs)) continue
        const y1 = pad.top + ((startMs - minD) / eraRange) * lineH
        const y2 = pad.top + ((endMs - minD) / eraRange) * lineH
        const ey1 = Math.max(pad.top, y1)
        const ey2 = Math.min(H - pad.bottom, y2)
        const color = era.color || '#3b82f6'
        svg.appendChild(svgEl('rect', {
          x: pad.left - 10, y: ey1, width: W - pad.left - pad.right + 20, height: ey2 - ey1,
          rx: 4, fill: color, opacity: 0.08,
        }))
        const eraLabel = svgEl('text', {
          x: W - pad.right + 5, y: (ey1 + ey2) / 2 + 4,
          fill: color, 'font-size': 9, 'font-weight': 600, opacity: 0.6,
        })
        eraLabel.textContent = era.name
        svg.appendChild(eraLabel)
      }
    }

    // Axis line
    svg.appendChild(svgEl('line', {
      x1: axisX, y1: pad.top, x2: axisX, y2: H - pad.bottom,
      stroke: axisColor, 'stroke-width': 2, opacity: 0.3,
    }))

    // Events
    events.forEach((ev, i) => {
      const y = positions[i]
      const color = getColor(ev.category, catColors)

      // Connecting line
      svg.appendChild(svgEl('line', {
        x1: axisX, y1: y, x2: axisX + 30, y2: y,
        stroke: color, 'stroke-width': 1.5, opacity: 0.3,
      }))

      // Dot
      const dot = svgEl('circle', {
        cx: axisX, cy: y, r: 6,
        fill: color, stroke: 'rgba(0,0,0,0.3)', 'stroke-width': 2,
      })
      dot.style.cursor = 'pointer'
      dot.style.transition = 'r 0.15s'
      dot.addEventListener('mouseenter', () => {
        dot.setAttribute('r', '9')
        showTooltip(axisX + 40, y, ev.label, ev.description)
      })
      dot.addEventListener('mouseleave', () => {
        dot.setAttribute('r', '6')
        hideTooltip()
      })
      svg.appendChild(dot)

      // Label
      const label = svgEl('text', {
        x: axisX + 40, y: y - 2,
        fill: textColor, 'font-size': 12, 'font-weight': 600,
      })
      label.textContent = ev.label
      svg.appendChild(label)

      // Description
      if (ev.description) {
        const desc = svgEl('text', {
          x: axisX + 40, y: y + 14,
          fill: mutedColor, 'font-size': 10,
        })
        desc.textContent = ev.description.length > 40 ? ev.description.slice(0, 37) + '...' : ev.description
        svg.appendChild(desc)
      }

      // Date on left side of axis
      if (ev.dateStr) {
        const dateLabel = svgEl('text', {
          x: axisX - 12, y: y + 4,
          'text-anchor': 'end',
          fill: mutedColor, 'font-size': 9,
        })
        dateLabel.textContent = formatDate(ev.dateStr)
        svg.appendChild(dateLabel)
      }
    })

    // Legend (if multiple categories)
    const categories = [...new Set(events.map(e => e.category))]
    if (categories.length > 1) {
      let lx = axisX + 40
      const ly = H - 12
      for (const cat of categories) {
        const color = getColor(cat, catColors)
        svg.appendChild(svgEl('circle', { cx: lx + 5, cy: ly - 3, r: 4, fill: color }))
        const t = svgEl('text', {
          x: lx + 14, y: ly, fill: mutedColor, 'font-size': 10,
        })
        t.textContent = cat
        svg.appendChild(t)
        lx += cat.length * 7 + 28
      }
    }
  }

  function render() {
    const rect = root.getBoundingClientRect()
    const W = Math.max(200, rect.width)
    const H = Math.max(120, rect.height)

    if (config.orientation === 'vertical') {
      renderVertical(W, H)
    } else {
      renderHorizontal(W, H)
    }
  }

  const ro = new ResizeObserver(() => render())
  ro.observe(root)
  render()

  const controller: ArtifactController = {
    update(next: TimelineConfig) {
      config = { ...config, ...next }
      render()
    },
    destroy() {
      ro.disconnect()
      hideTooltip()
      if (tooltip) { tooltip.remove(); tooltip = null }
      root.removeChild(svg)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Timeline', createTimeline)
