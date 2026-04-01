import type { ArtifactController, ArtifactFactory } from './index'

type MolnarConfig = Partial<{
  gridCols: number
  gridRows: number
  disruption: boolean
}>

export const createMolnar: ArtifactFactory = (root: HTMLElement, initialConfig: MolnarConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let mx = -1, my = -1
  let raf = 0

  let config: Required<MolnarConfig> = {
    gridCols: 24,
    gridRows: 24,
    disruption: true,
    ...initialConfig,
  } as any

  type Cell = { x: number; y: number; w: number; h: number; baseAngle: number; seed: number }
  let grid: Cell[] = []

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
    grid = []
    const cols = config.gridCols
    const rows = config.gridRows
    const cellW = W / cols
    const cellH = H / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid.push({
          x: c * cellW + cellW / 2,
          y: r * cellH + cellH / 2,
          w: cellW * 0.7,
          h: cellH * 0.7,
          baseAngle: (Math.random() - 0.5) * 0.15,
          seed: Math.random(),
        })
      }
    }
  }

  function loop() {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#c0c0c0'
    ctx.lineWidth = 1

    const radius = Math.min(W, H) * 0.25
    for (const g of grid) {
      const dx = mx - g.x
      const dy = my - g.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const influence = config.disruption ? Math.max(0, 1 - dist / radius) : 0
      const disruption = influence * influence
      const angle = g.baseAngle + disruption * (g.seed - 0.5) * Math.PI * 1.5
      const scale = 1 - disruption * 0.4 * g.seed
      const ox = disruption * (g.seed - 0.5) * 12
      const oy = disruption * (g.seed - 0.5) * 12

      ctx.save()
      ctx.translate(g.x + ox, g.y + oy)
      ctx.rotate(angle)
      ctx.globalAlpha = 0.4 + 0.6 * (1 - disruption * 0.5)
      ctx.strokeRect(-g.w * scale / 2, -g.h * scale / 2, g.w * scale, g.h * scale)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    raf = requestAnimationFrame(loop)
  }

  function onMouseMove(e: MouseEvent) {
    const rect = root.getBoundingClientRect()
    mx = e.clientX - rect.left
    my = e.clientY - rect.top
  }
  function onMouseLeave() { mx = -1; my = -1 }
  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    const rect = root.getBoundingClientRect()
    mx = t.clientX - rect.left
    my = t.clientY - rect.top
  }
  function onTouchEnd() { mx = -1; my = -1 }
  function onClick() { generate() }

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)

  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseleave', onMouseLeave, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  root.addEventListener('click', onClick)

  resize()
  raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: MolnarConfig) {
      const nextMerged = { ...config, ...next }
      const gridChanged = nextMerged.gridCols !== config.gridCols || nextMerged.gridRows !== config.gridRows
      config = nextMerged
      if (gridChanged) generate()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('click', onClick)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Molnar', createMolnar)
