import type { ArtifactController, ArtifactFactory } from './index'

type HarmonographConfig = Partial<{
  damping: number
  stepsPerFrame: number
  hue: number
}>

type Pendulum = { f: number; p: number; a: number; d: number }
type Pendulums = { x1: Pendulum; x2: Pendulum; y1: Pendulum; y2: Pendulum }

export const createHarmonograph: ArtifactFactory = (root: HTMLElement, initialConfig: HarmonographConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let raf = 0
  let drawing = false

  let config: Required<HarmonographConfig> = {
    damping: 0.002,
    stepsPerFrame: 40,
    hue: 35,
    ...initialConfig,
  } as any

  let pens: Pendulums
  let t = 0
  let prev = { x: 0, y: 0 }
  let strokeHue = 0

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function randomFreq(): number {
    const base = 1 + Math.floor(Math.random() * 4)
    return base + (Math.random() - 0.5) * 0.02
  }

  function initPendulums() {
    const d = config.damping
    pens = {
      x1: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.4 + Math.random() * 0.15, d: d * 0.5 + Math.random() * d * 1.5 },
      x2: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.2 + Math.random() * 0.15, d: d * 0.25 + Math.random() * d },
      y1: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.4 + Math.random() * 0.15, d: d * 0.5 + Math.random() * d * 1.5 },
      y2: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.2 + Math.random() * 0.15, d: d * 0.25 + Math.random() * d },
    }
  }

  function getPoint(t: number): { x: number; y: number } {
    const scale = Math.min(W, H) * 0.42
    const cx = W / 2, cy = H / 2

    const x = pens.x1.a * Math.sin(pens.x1.f * t + pens.x1.p) * Math.exp(-pens.x1.d * t)
            + pens.x2.a * Math.sin(pens.x2.f * t + pens.x2.p) * Math.exp(-pens.x2.d * t)
    const y = pens.y1.a * Math.sin(pens.y1.f * t + pens.y1.p) * Math.exp(-pens.y1.d * t)
            + pens.y2.a * Math.sin(pens.y2.f * t + pens.y2.p) * Math.exp(-pens.y2.d * t)

    return { x: cx + x * scale, y: cy + y * scale }
  }

  function start() {
    cancelAnimationFrame(raf)
    resize()
    ctx.fillStyle = '#0a0a12'
    ctx.fillRect(0, 0, W, H)
    initPendulums()
    t = 0
    drawing = true

    strokeHue = (config.hue - 10) + Math.random() * 25
    prev = getPoint(0)

    const dt = 0.04

    function draw() {
      for (let i = 0; i < config.stepsPerFrame; i++) {
        t += dt
        const cur = getPoint(t)

        const amp = Math.exp(-Math.min(pens.x1.d, pens.y1.d) * t)
        if (amp < 0.005) {
          drawing = false
          return
        }

        const alpha = Math.min(0.8, 0.15 + amp * 0.6)
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(cur.x, cur.y)
        ctx.strokeStyle = `hsla(${strokeHue}, 50%, 65%, ${alpha})`
        ctx.lineWidth = 0.5 + amp * 1.2
        ctx.lineCap = 'round'
        ctx.stroke()

        prev = cur
      }

      if (drawing) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
  }

  function onClick() { start() }
  function onTouchStart(e: TouchEvent) { e.preventDefault(); start() }

  const ro = new ResizeObserver(() => { if (!drawing) resize() })
  ro.observe(root)

  canvas.addEventListener('click', onClick)
  canvas.addEventListener('touchstart', onTouchStart, { passive: false })

  // Initial layout + drawing start
  resize()
  start()

  const controller: ArtifactController = {
    update(next: HarmonographConfig) {
      config = { ...config, ...next }
      // Restart with new config
      start()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchstart', onTouchStart)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Harmonograph', createHarmonograph)
