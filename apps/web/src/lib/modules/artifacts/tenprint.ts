import type { ArtifactController, ArtifactFactory } from './index'

type TenPrintConfig = Partial<{
  cellSize: number
  lineWidth: number
  color: string
  bgColor: string
}>

export const createTenPrint: ArtifactFactory = (root: HTMLElement, initialConfig: TenPrintConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let x = 0, y = 0
  let raf = 0

  let config: Required<TenPrintConfig> = {
    cellSize: 22,
    lineWidth: 2,
    color: '#c0c0c0',
    bgColor: '#050b07',
    ...initialConfig,
  } as any

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    resetDraw()
  }

  function resetDraw() {
    x = 0
    y = 0
    ctx.fillStyle = config.bgColor
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = config.color
    ctx.lineWidth = config.lineWidth
    ctx.lineCap = 'square'
  }

  function loop() {
    const size = config.cellSize
    const linesPerFrame = 6

    for (let i = 0; i < linesPerFrame; i++) {
      if (y >= H) {
        resetDraw()
        raf = requestAnimationFrame(loop)
        return
      }
      ctx.beginPath()
      if (Math.random() > 0.5) {
        ctx.moveTo(x, y)
        ctx.lineTo(x + size, y + size)
      } else {
        ctx.moveTo(x + size, y)
        ctx.lineTo(x, y + size)
      }
      ctx.stroke()
      x += size
      if (x >= W) { x = 0; y += size }
    }
    raf = requestAnimationFrame(loop)
  }

  function onClick() { resetDraw() }

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)
  root.addEventListener('click', onClick)

  resize()
  raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: TenPrintConfig) {
      const nextMerged = { ...config, ...next }
      config = nextMerged
      resetDraw()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.removeEventListener('click', onClick)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('10 PRINT', createTenPrint)
