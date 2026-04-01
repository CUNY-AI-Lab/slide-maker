import type { ArtifactController, ArtifactFactory } from './index'

type BoidsConfig = Partial<{
  count: number
  maxSpeed: number
  separationRadius: number
  alignmentRadius: number
  cohesionRadius: number
  separationWeight: number
  alignmentWeight: number
  cohesionWeight: number
}>

export const createBoids: ArtifactFactory = (root: HTMLElement, initialConfig: BoidsConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let px: number | null = null, py: number | null = null
  let raf = 0

  let config: Required<BoidsConfig> = {
    count: 120,
    maxSpeed: 2.2,
    separationRadius: 18,
    alignmentRadius: 42,
    cohesionRadius: 52,
    separationWeight: 1.35,
    alignmentWeight: 0.85,
    cohesionWeight: 0.65,
    ...initialConfig,
  } as any

  type B = { x: number; y: number; vx: number; vy: number }
  const boid: B[] = []

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function reset() {
    boid.length = 0
    for (let i = 0; i < config.count; i++) {
      boid.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() * 2 - 1) * 0.8,
        vy: (Math.random() * 2 - 1) * 0.8,
      })
    }
  }

  function wrap(b: B) {
    if (b.x < -20) b.x = W + 20
    if (b.x > W + 20) b.x = -20
    if (b.y < -20) b.y = H + 20
    if (b.y > H + 20) b.y = -20
  }

  function loop() {
    ctx.fillStyle = '#05070b'
    ctx.fillRect(0, 0, W, H)

    const maxSpeed = config.maxSpeed
    const maxForce = 0.06
    const sepR2 = config.separationRadius * config.separationRadius
    const aliR2 = config.alignmentRadius * config.alignmentRadius
    const cohR2 = config.cohesionRadius * config.cohesionRadius

    for (let i = 0; i < boid.length; i++) {
      const b = boid[i]
      let sx = 0, sy = 0, sa = 0
      let ax = 0, ay = 0, aa = 0
      let cx = 0, cy = 0, ca = 0

      for (let j = 0; j < boid.length; j++) {
        if (i === j) continue
        const o = boid[j]
        const dx = o.x - b.x
        const dy = o.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < 1e-4) continue
        if (d2 < sepR2) {
          const d = Math.sqrt(d2)
          sx -= dx / d
          sy -= dy / d
          sa++
        }
        if (d2 < aliR2) {
          ax += o.vx
          ay += o.vy
          aa++
        }
        if (d2 < cohR2) {
          cx += o.x
          cy += o.y
          ca++
        }
      }

      let fx = 0, fy = 0
      if (sa) {
        sx /= sa; sy /= sa
        const m = Math.hypot(sx, sy) || 1
        sx = (sx / m) * maxSpeed - b.vx
        sy = (sy / m) * maxSpeed - b.vy
        const sm = Math.hypot(sx, sy) || 1
        if (sm > 0.06) { sx = (sx / sm) * 0.06; sy = (sy / sm) * 0.06 }
        fx += sx * config.separationWeight
        fy += sy * config.separationWeight
      }
      if (aa) {
        ax /= aa; ay /= aa
        const m = Math.hypot(ax, ay) || 1
        ax = (ax / m) * maxSpeed - b.vx
        ay = (ay / m) * maxSpeed - b.vy
        const am = Math.hypot(ax, ay) || 1
        if (am > maxForce) { ax = (ax / am) * maxForce; ay = (ay / am) * maxForce }
        fx += ax * config.alignmentWeight
        fy += ay * config.alignmentWeight
      }
      if (ca) {
        cx = cx / ca - b.x
        cy = cy / ca - b.y
        const m = Math.hypot(cx, cy) || 1
        cx = (cx / m) * maxSpeed - b.vx
        cy = (cy / m) * maxSpeed - b.vy
        const cm = Math.hypot(cx, cy) || 1
        if (cm > maxForce) { cx = (cx / cm) * maxForce; cy = (cy / cm) * maxForce }
        fx += cx * config.cohesionWeight
        fy += cy * config.cohesionWeight
      }

      if (px != null) {
        const dx = px - b.x
        const dy = py! - b.y
        const d = Math.hypot(dx, dy) || 1
        const pull = Math.min(1, 180 / d) * 0.015
        fx += (dx / d) * pull
        fy += (dy / d) * pull
      }

      b.vx += fx; b.vy += fy
      const sp = Math.hypot(b.vx, b.vy) || 1
      if (sp > maxSpeed) { b.vx = (b.vx / sp) * maxSpeed; b.vy = (b.vy / sp) * maxSpeed }
      b.x += b.vx; b.y += b.vy
      wrap(b)
    }

    ctx.fillStyle = 'rgba(192,192,192,0.7)'
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 1
    for (const b of boid) {
      const a = Math.atan2(b.vy, b.vx)
      const s = 7
      ctx.beginPath()
      ctx.moveTo(b.x + Math.cos(a) * s, b.y + Math.sin(a) * s)
      ctx.lineTo(b.x + Math.cos(a + 2.4) * s * 0.75, b.y + Math.sin(a + 2.4) * s * 0.75)
      ctx.lineTo(b.x + Math.cos(a - 2.4) * s * 0.75, b.y + Math.sin(a - 2.4) * s * 0.75)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
    }

    raf = requestAnimationFrame(loop)
  }

  function onMouseMove(e: MouseEvent) { px = e.clientX - root.getBoundingClientRect().left; py = e.clientY - root.getBoundingClientRect().top }
  function onMouseLeave() { px = py = null }
  function onTouchMove(e: TouchEvent) { const t = e.touches[0]; if (!t) return; const r = root.getBoundingClientRect(); px = t.clientX - r.left; py = t.clientY - r.top }
  function onTouchEnd() { px = py = null }

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)

  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseleave', onMouseLeave, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })

  // Initial layout + simulation start
  resize(); reset(); raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: BoidsConfig) {
      const nextMerged = { ...config, ...next }
      const countChanged = nextMerged.count !== config.count
      config = nextMerged
      if (countChanged) reset()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Boids', createBoids)

