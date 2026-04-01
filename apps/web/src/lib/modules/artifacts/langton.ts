import type { ArtifactController, ArtifactFactory } from './index'

type LangtonConfig = Partial<{
  cellSize: number
  stepsPerFrame: number
  startingAnts: number
}>

export const createLangton: ArtifactFactory = (root: HTMLElement, initialConfig: LangtonConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.imageRendering = 'pixelated'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let raf = 0

  let config: Required<LangtonConfig> = {
    cellSize: 3,
    stepsPerFrame: 50,
    startingAnts: 1,
    ...initialConfig,
  } as any

  // Directions: 0=N 1=E 2=S 3=W
  const DX = [0, 1, 0, -1]
  const DY = [-1, 0, 1, 0]

  const PALETTE: [number, number, number][] = [
    [10, 10, 20],     // state 0: dark bg
    [230, 180, 60],   // state 1: amber
  ]

  type Ant = { x: number; y: number; d: number; h: number }
  let cols = 0, rows = 0
  let grid: Uint8Array = new Uint8Array(0)
  let ants: Ant[] = []
  let step = 0
  let running = true

  function hueToRgb(h: number): [number, number, number] {
    const hn = h / 360
    const hi = Math.floor(hn * 6)
    const f = hn * 6 - hi
    const q = Math.floor((1 - f) * 255)
    const t = Math.floor(f * 255)
    const table: [number, number, number][] = [
      [255, t, 0], [q, 255, 0], [0, 255, t],
      [0, q, 255], [t, 0, 255], [255, 0, q],
    ]
    return table[hi % 6]
  }

  function init() {
    const CELL = config.cellSize
    const rect = root.getBoundingClientRect()
    cols = Math.floor(Math.max(1, rect.width) / CELL)
    rows = Math.floor(Math.max(1, rect.height) / CELL)
    canvas.width = cols
    canvas.height = rows
    grid = new Uint8Array(cols * rows)
    ants = []
    for (let i = 0; i < config.startingAnts; i++) {
      ants.push({
        x: Math.floor(cols / 2) + i * 3,
        y: Math.floor(rows / 2),
        d: Math.floor(Math.random() * 4),
        h: 120 + i * 60,
      })
    }
    step = 0
  }

  function tick() {
    for (const a of ants) {
      const i = a.y * cols + a.x
      const s = grid[i]
      // RL rule: state 0 turn right (+1), state 1 turn left (-1)
      a.d = ((a.d + (s === 0 ? 1 : -1)) + 4) % 4
      grid[i] = 1 - s
      a.x = (a.x + DX[a.d] + cols) % cols
      a.y = (a.y + DY[a.d] + rows) % rows
    }
    step++
  }

  function draw() {
    const img = ctx.getImageData(0, 0, cols, rows)
    const d = img.data
    for (let i = 0; i < cols * rows; i++) {
      const s = grid[i]
      const b = i * 4
      const p = PALETTE[s]
      d[b] = p[0]; d[b + 1] = p[1]; d[b + 2] = p[2]; d[b + 3] = 255
    }
    // Mark ant positions
    for (const a of ants) {
      const b = (a.y * cols + a.x) * 4
      const [r, g, bl] = hueToRgb(a.h)
      d[b] = r; d[b + 1] = g; d[b + 2] = bl; d[b + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }

  function loop() {
    if (running) {
      for (let i = 0; i < config.stepsPerFrame; i++) tick()
    }
    draw()
    raf = requestAnimationFrame(loop)
  }

  function onClick(e: MouseEvent) {
    const r = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - r.left) / r.width * cols)
    const y = Math.floor((e.clientY - r.top) / r.height * rows)
    ants.push({ x, y, d: Math.floor(Math.random() * 4), h: Math.random() * 360 })
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault()
    const t = e.changedTouches[0]
    const r = canvas.getBoundingClientRect()
    const x = Math.floor((t.clientX - r.left) / r.width * cols)
    const y = Math.floor((t.clientY - r.top) / r.height * rows)
    ants.push({ x, y, d: Math.floor(Math.random() * 4), h: Math.random() * 360 })
  }

  const ro = new ResizeObserver(() => { init() })
  ro.observe(root)

  canvas.addEventListener('click', onClick)
  canvas.addEventListener('touchend', onTouchEnd, { passive: false })

  // Initial layout + simulation start
  init()
  raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: LangtonConfig) {
      const nextMerged = { ...config, ...next }
      const needsReset = nextMerged.cellSize !== config.cellSize || nextMerged.startingAnts !== config.startingAnts
      config = nextMerged
      if (needsReset) init()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchend', onTouchEnd)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact("Langton's Ant", createLangton)
