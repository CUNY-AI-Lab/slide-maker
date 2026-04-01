import type { ArtifactController, ArtifactFactory } from './index'

type LorenzConfig = Partial<{
  particleCount: number
  sigma: number
  rho: number
  beta: number
  trailLength: number
  speed: number
}>

export const createLorenz: ArtifactFactory = (root: HTMLElement, initialConfig: LorenzConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let raf = 0

  let config: Required<LorenzConfig> = {
    particleCount: 6,
    sigma: 10,
    rho: 28,
    beta: 2.667,
    trailLength: 600,
    speed: 0.005,
    ...initialConfig,
  } as any

  const hues = [200, 260, 320, 40, 160, 80]

  type Particle = { x: number; y: number; z: number }
  let particles: Particle[] = []
  let trails: Particle[][] = []

  let angle = 0, targetAngle = 0
  let dragging = false, dragStartX = 0, dragStartAngle = 0

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function init() {
    particles = []
    trails = []
    for (let i = 0; i < config.particleCount; i++) {
      const p: Particle = {
        x: 0.1 + (Math.random() - 0.5) * 0.01,
        y: (Math.random() - 0.5) * 0.01,
        z: 25 + (Math.random() - 0.5) * 0.01,
      }
      particles.push(p)
      trails.push([{ x: p.x, y: p.y, z: p.z }])
    }
  }

  function project(wx: number, wy: number, wz: number) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle)
    const px = wx * cosA + wz * sinA
    const py = wy
    const scale = Math.min(W, H) / 55
    return { sx: W / 2 + px * scale, sy: H * 0.55 - py * scale }
  }

  function integrate() {
    const { sigma, rho, beta, speed: dt } = config
    for (let i = 0; i < config.particleCount; i++) {
      const p = particles[i]
      p.x += sigma * (p.y - p.x) * dt
      p.y += (p.x * (rho - p.z) - p.y) * dt
      p.z += (p.x * p.y - beta * p.z) * dt
      trails[i].push({ x: p.x, y: p.y, z: p.z })
      if (trails[i].length > config.trailLength) trails[i].shift()
    }
  }

  function loop() {
    if (!dragging) targetAngle += 0.002
    angle += (targetAngle - angle) * 0.08
    for (let s = 0; s < 4; s++) integrate()

    ctx.fillStyle = '#05070b'
    ctx.fillRect(0, 0, W, H)
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 0; i < config.particleCount; i++) {
      const trail = trails[i]
      if (trail.length < 2) continue
      const hue = hues[i % hues.length]
      let prev = project(trail[0].x, trail[0].y, trail[0].z)
      for (let j = 1; j < trail.length; j++) {
        const cur = project(trail[j].x, trail[j].y, trail[j].z)
        const alpha = (j / trail.length) * 0.85
        ctx.strokeStyle = `hsla(${hue},80%,65%,${alpha})`
        ctx.beginPath()
        ctx.moveTo(prev.sx, prev.sy)
        ctx.lineTo(cur.sx, cur.sy)
        ctx.stroke()
        prev = cur
      }
      const head = project(trail[trail.length - 1].x, trail[trail.length - 1].y, trail[trail.length - 1].z)
      ctx.fillStyle = `hsla(${hue},90%,80%,0.95)`
      ctx.beginPath()
      ctx.arc(head.sx, head.sy, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    raf = requestAnimationFrame(loop)
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true
    dragStartX = e.clientX
    dragStartAngle = targetAngle
    canvas.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: PointerEvent) {
    if (dragging) targetAngle = dragStartAngle + (e.clientX - dragStartX) * 0.01
  }
  function onPointerUp() { dragging = false }

  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  window.addEventListener('pointercancel', onPointerUp, { passive: true })

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)

  resize()
  init()
  raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: LorenzConfig) {
      const nextMerged = { ...config, ...next }
      const countChanged = nextMerged.particleCount !== config.particleCount
      config = nextMerged
      if (countChanged) init()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Lorenz Attractor', createLorenz)
