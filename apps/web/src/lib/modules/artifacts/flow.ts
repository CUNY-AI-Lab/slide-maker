import type { ArtifactController, ArtifactFactory } from './index'

type FlowConfig = Partial<{
  particleCount: number
  noiseScale: number
  maxSpeed: number
  damping: number
  hueStart: number
  hueRange: number
}>

class Perlin {
  private p: number[] = []
  constructor() {
    for (let i = 0; i < 512; i++) this.p[i] = Math.floor(Math.random() * 256)
  }
  private fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10) }
  private lerp(t: number, a: number, b: number): number { return a + t * (b - a) }
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : x
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    const u = this.fade(x)
    const v = this.fade(y)
    const a = this.p[X] + Y
    const b = this.p[X + 1] + Y
    return this.lerp(v,
      this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
      this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
    )
  }
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  maxSpeed: number
  hue: number
}

export const createFlow: ArtifactFactory = (root: HTMLElement, initialConfig: FlowConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let raf = 0
  let time = 0

  let config: Required<FlowConfig> = {
    particleCount: 3000,
    noiseScale: 0.003,
    maxSpeed: 2,
    damping: 0.95,
    hueStart: 180,
    hueRange: 60,
    ...initialConfig,
  } as Required<FlowConfig>

  const perlin = new Perlin()
  let particles: Particle[] = []
  let mx: number | null = null, my: number | null = null

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function createParticle(): Particle {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      alpha: Math.random() * 0.5 + 0.3,
      maxSpeed: config.maxSpeed,
      hue: Math.random() * config.hueRange + config.hueStart,
    }
  }

  function initParticles() {
    particles = []
    for (let i = 0; i < config.particleCount; i++) particles.push(createParticle())
  }

  function loop() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.fillRect(0, 0, W, H)

    const scale = config.noiseScale

    for (const p of particles) {
      let angle = perlin.noise(p.x * scale, p.y * scale + time * 0.0001) * Math.PI * 4
      p.vx += Math.cos(angle) * 0.1
      p.vy += Math.sin(angle) * 0.1

      // Mouse perturbation
      if (mx != null && my != null) {
        const dx = mx - p.x
        const dy = my! - p.y
        const d = Math.hypot(dx, dy) || 1
        if (d < 150) {
          const force = (1 - d / 150) * 0.3
          p.vx += (dx / d) * force
          p.vy += (dy / d) * force
        }
      }

      const speed = Math.hypot(p.vx, p.vy)
      if (speed > p.maxSpeed) {
        p.vx = (p.vx / speed) * p.maxSpeed
        p.vy = (p.vy / speed) * p.maxSpeed
      }
      p.x += p.vx
      p.y += p.vy
      p.vx *= config.damping
      p.vy *= config.damping

      if (p.x < 0) p.x = W
      if (p.x > W) p.x = 0
      if (p.y < 0) p.y = H
      if (p.y > H) p.y = 0

      ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.alpha})`
      ctx.fillRect(p.x, p.y, 2, 2)
    }

    time++
    raf = requestAnimationFrame(loop)
  }

  function onMouseMove(e: MouseEvent) {
    const rect = root.getBoundingClientRect()
    mx = e.clientX - rect.left
    my = e.clientY - rect.top
  }
  function onMouseLeave() { mx = my = null }
  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    const rect = root.getBoundingClientRect()
    mx = t.clientX - rect.left
    my = t.clientY - rect.top
  }
  function onTouchEnd() { mx = my = null }

  const ro = new ResizeObserver(() => {
    resize()
    // Clear canvas on resize to avoid trails at old size
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    // Re-position particles within new bounds
    for (const p of particles) {
      if (p.x > W) p.x = Math.random() * W
      if (p.y > H) p.y = Math.random() * H
    }
  })
  ro.observe(root)

  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseleave', onMouseLeave, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })

  // Initial layout + start
  resize()
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  initParticles()
  raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: FlowConfig) {
      const prevCount = config.particleCount
      config = { ...config, ...next } as Required<FlowConfig>
      if (config.particleCount !== prevCount) {
        initParticles()
      }
      // Update existing particles with new config values
      for (const p of particles) {
        p.maxSpeed = config.maxSpeed
      }
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
registerArtifact('Flow Field', createFlow)
