import type { ArtifactController, ArtifactFactory } from './index'

type TruchetConfig = Partial<{
  mode: 'arcs' | 'triangles' | 'diagonal'
  tileSize: number
  flipInterval: number
  lineWidth: number
  palette: 'monochrome' | 'earth' | 'neon' | 'forest' | 'ocean'
}>

export const createTruchet: ArtifactFactory = (root: HTMLElement, initialConfig: TruchetConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let raf = 0
  let lastFlip = 0

  const modeMap: Record<string, number> = { arcs: 0, triangles: 1, diagonal: 2 }
  const palMap: Record<string, number> = { monochrome: 0, earth: 1, neon: 2, forest: 3, ocean: 4 }
  const modeNames = ['arcs', 'triangles', 'diagonal'] as const

  const palettes = [
    ['#e8e8e8', '#1a1a2e'],                       // monochrome
    ['#264653', '#2a9d8f', '#e9c46a'],             // earth
    ['#f72585', '#7209b7', '#3a0ca3'],             // neon
    ['#606c38', '#283618', '#dda15e'],             // forest
    ['#0077b6', '#00b4d8', '#90e0ef'],             // ocean
  ]

  let config: Required<TruchetConfig> = {
    mode: 'arcs',
    tileSize: 45,
    flipInterval: 120,
    lineWidth: 0.12,
    palette: 'monochrome',
    ...initialConfig,
  } as Required<TruchetConfig>

  let mode = modeMap[config.mode] ?? 0
  let palette = palettes[0]
  let tileSize = config.tileSize
  let grid: number[][] = []

  function pickPalette() {
    const pi = palMap[config.palette]
    palette = pi != null ? palettes[pi] : palettes[Math.floor(Math.random() * palettes.length)]
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    tileSize = config.tileSize > 0
      ? config.tileSize
      : Math.max(30, Math.min(60, Math.floor(Math.min(W, H) / 14)))
  }

  function generate() {
    pickPalette()
    const cols = Math.ceil(W / tileSize) + 1
    const rows = Math.ceil(H / tileSize) + 1
    grid = []
    for (let r = 0; r < rows; r++) {
      const row: number[] = []
      for (let c = 0; c < cols; c++) {
        row.push(Math.random() < 0.5 ? 0 : 1)
      }
      grid.push(row)
    }
    draw()
  }

  function drawArcTile(x: number, y: number, s: number, flip: boolean) {
    ctx.lineWidth = s * config.lineWidth
    ctx.lineCap = 'round'
    ctx.strokeStyle = palette[0]
    if (flip) {
      ctx.beginPath()
      ctx.arc(x + s, y, s / 2, Math.PI * 0.5, Math.PI)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y + s, s / 2, -Math.PI * 0.5, 0)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, s / 2, 0, Math.PI * 0.5)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + s, y + s, s / 2, Math.PI, Math.PI * 1.5)
      ctx.stroke()
    }
  }

  function drawTriTile(x: number, y: number, s: number, flip: boolean) {
    const c1 = palette[0]
    const c2 = palette.length > 2 ? palette[1] : palette[0]
    if (flip) {
      ctx.fillStyle = c1
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.closePath()
      ctx.fill()
      ctx.fillStyle = c2
      ctx.beginPath()
      ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillStyle = c1
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.closePath()
      ctx.fill()
      ctx.fillStyle = c2
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath()
      ctx.fill()
    }
  }

  function drawDiagTile(x: number, y: number, s: number, flip: boolean) {
    ctx.lineWidth = s * config.lineWidth * 0.67
    ctx.lineCap = 'round'
    const colors = palette.length > 2 ? palette : [palette[0], palette[0]]
    const nLines = 5
    for (let i = 0; i <= nLines; i++) {
      const t = i / nLines
      ctx.strokeStyle = colors[i % colors.length]
      ctx.globalAlpha = 0.5 + t * 0.5
      ctx.beginPath()
      if (flip) {
        ctx.moveTo(x + s * t, y)
        ctx.lineTo(x, y + s * t)
        if (i > 0) {
          ctx.moveTo(x + s, y + s * (1 - t))
          ctx.lineTo(x + s * (1 - t), y + s)
        }
      } else {
        ctx.moveTo(x + s * (1 - t), y)
        ctx.lineTo(x + s, y + s * t)
        if (i > 0) {
          ctx.moveTo(x, y + s * (1 - t))
          ctx.lineTo(x + s * t, y + s)
        }
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  const drawFns = [drawArcTile, drawTriTile, drawDiagTile]

  function draw() {
    ctx.fillStyle = palette.length > 2 ? palette[2] : '#0a0a0a'
    ctx.fillRect(0, 0, W, H)
    const fn = drawFns[mode]
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        fn(c * tileSize, r * tileSize, tileSize, grid[r][c] === 1)
      }
    }
  }

  function animate(t: number) {
    if (t - lastFlip > config.flipInterval && grid.length > 0) {
      const r = Math.floor(Math.random() * grid.length)
      const c = Math.floor(Math.random() * grid[0].length)
      grid[r][c] = 1 - grid[r][c]
      draw()
      lastFlip = t
    }
    raf = requestAnimationFrame(animate)
  }

  const ro = new ResizeObserver(() => {
    resize()
    generate()
  })
  ro.observe(root)

  // Initial layout + start
  resize()
  generate()
  raf = requestAnimationFrame(animate)

  const controller: ArtifactController = {
    update(next: TruchetConfig) {
      const prev = { ...config }
      config = { ...config, ...next } as Required<TruchetConfig>
      mode = modeMap[config.mode] ?? 0
      const sizeChanged = config.tileSize !== prev.tileSize
      const paletteChanged = config.palette !== prev.palette
      if (sizeChanged) {
        tileSize = config.tileSize
        resize()
        generate()
      } else if (paletteChanged) {
        pickPalette()
        draw()
      } else if (config.mode !== prev.mode) {
        draw()
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Truchet Tiles', createTruchet)
