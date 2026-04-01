import type { ArtifactController, ArtifactFactory } from './index'

type NakeConfig = Partial<{
  gridCols: number
  gridRows: number
  maxSubdivision: number
}>

export const createNake: ArtifactFactory = (root: HTMLElement, initialConfig: NakeConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0

  let config: Required<NakeConfig> = {
    gridCols: 8,
    gridRows: 7,
    maxSubdivision: 2,
    ...initialConfig,
  } as any

  // Bauhaus-inspired palette (Nake was influenced by constructivism)
  const palette = [
    '#c23b22', // red
    '#2d5da1', // blue
    '#f0c75e', // yellow
    '#1a1a1a', // black
    '#e8e0d0', // cream (empty)
    '#d35400', // orange
    '#2e7d32', // green
    '#5c3d2e', // brown
  ]

  // Seeded PRNG (mulberry32)
  function mulberry32(a: number) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0
      let t = Math.imul(a ^ a >>> 15, 1 | a)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    generate()
  }

  function generate() {
    const seed = Date.now() & 0xFFFFFF
    const rand = mulberry32(seed)

    // Parchment background
    ctx.fillStyle = '#f0ece4'
    ctx.fillRect(0, 0, W, H)

    const margin = Math.min(W, H) * 0.08
    const drawW = W - margin * 2
    const drawH = H - margin * 2
    const cols = config.gridCols
    const rows = config.gridRows
    const cellW = drawW / cols
    const cellH = drawH / rows

    function drawCell(x: number, y: number, w: number, h: number) {
      const r = rand()

      if (r < 0.35) {
        // Solid color fill
        const colorIdx = Math.floor(rand() * palette.length)
        ctx.fillStyle = palette[colorIdx]
        ctx.globalAlpha = 0.6 + rand() * 0.35
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
        ctx.globalAlpha = 1
      } else if (r < 0.55) {
        // Horizontal hatching
        const spacing = 3 + Math.floor(rand() * 5)
        ctx.strokeStyle = 'rgba(30, 25, 20, 0.4)'
        ctx.lineWidth = 0.5
        for (let ly = y + spacing; ly < y + h; ly += spacing) {
          ctx.beginPath()
          ctx.moveTo(x + 2, ly)
          ctx.lineTo(x + w - 2, ly)
          ctx.stroke()
        }
      } else if (r < 0.7) {
        // Diagonal hatching
        const spacing = 4 + Math.floor(rand() * 4)
        ctx.strokeStyle = 'rgba(30, 25, 20, 0.3)'
        ctx.lineWidth = 0.5
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        const dir = rand() > 0.5 ? 1 : -1
        for (let d = -Math.max(w, h); d < Math.max(w, h) * 2; d += spacing) {
          ctx.beginPath()
          ctx.moveTo(x + d, y)
          ctx.lineTo(x + d + h * dir, y + h)
          ctx.stroke()
        }
        ctx.restore()
      } else if (r < 0.82) {
        // Circle
        const radius = Math.min(w, h) * 0.35 * (0.5 + rand() * 0.5)
        const colorIdx = Math.floor(rand() * palette.length)
        ctx.beginPath()
        ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2)
        ctx.fillStyle = palette[colorIdx]
        ctx.globalAlpha = 0.5 + rand() * 0.3
        ctx.fill()
        ctx.globalAlpha = 1
      }
      // else: leave empty (cream background shows through)

      // Cell outline
      ctx.strokeStyle = 'rgba(30, 25, 20, 0.25)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, w, h)
    }

    function subdivide(x: number, y: number, w: number, h: number, depth: number) {
      if (depth <= 0 || w < 15 || h < 15) {
        drawCell(x, y, w, h)
        return
      }
      const r = rand()
      if (r < 0.4) {
        // Vertical split
        const split = 0.3 + rand() * 0.4
        const splitX = x + w * split
        subdivide(x, y, w * split, h, depth - 1)
        subdivide(splitX, y, w * (1 - split), h, depth - 1)
      } else if (r < 0.8) {
        // Horizontal split
        const split = 0.3 + rand() * 0.4
        const splitY = y + h * split
        subdivide(x, y, w, h * split, depth - 1)
        subdivide(x, splitY, w, h * (1 - split), depth - 1)
      } else {
        drawCell(x, y, w, h)
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margin + col * cellW
        const y = margin + row * cellH
        const maxDepth = Math.floor(rand() * (config.maxSubdivision + 1))
        subdivide(x, y, cellW, cellH, maxDepth)
      }
    }

    // Outer frame
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(margin, margin, drawW, drawH)
  }

  function onClick() { generate() }

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)
  root.addEventListener('click', onClick)

  resize()

  const controller: ArtifactController = {
    update(next: NakeConfig) {
      const nextMerged = { ...config, ...next }
      config = nextMerged
      generate()
    },
    destroy() {
      ro.disconnect()
      root.removeEventListener('click', onClick)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Nake', createNake)
