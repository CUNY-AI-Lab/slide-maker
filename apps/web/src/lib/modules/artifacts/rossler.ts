import type { ArtifactController, ArtifactFactory } from './index'

type RosslerConfig = Partial<{
  a: number
  b: number
  c: number
  trailLength: number
  speed: number
}>

export const createRossler: ArtifactFactory = (root: HTMLElement, initialConfig: RosslerConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let raf = 0

  let config: Required<RosslerConfig> = {
    a: 0.2,
    b: 0.2,
    c: 5.7,
    trailLength: 60000,
    speed: 0.005,
    ...initialConfig,
  } as any

  let x = 0.1, y = 0, z = 0
  let points: { x: number; y: number; z: number }[] = []

  let rotY = 0, rotX = -0.3
  let autoRotate = true
  let dragging = false, lastMX = 0, lastMY = 0

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function resetSim() {
    x = 0.1; y = 0; z = 0
    points = []
    ctx.fillStyle = '#050508'
    ctx.fillRect(0, 0, W, H)
  }

  function step() {
    const { a, b, c, speed: dt } = config
    const dx = -y - z
    const dy = x + a * y
    const dz = b + z * (x - c)
    x += dx * dt; y += dy * dt; z += dz * dt
    if (Math.abs(x) > 500 || Math.abs(y) > 500 || Math.abs(z) > 500) {
      x = 0.1; y = 0; z = 0; points = []
    }
    points.push({ x, y, z })
    if (points.length > config.trailLength) points.shift()
  }

  function project(px: number, py: number, pz: number) {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX)
    const rx = px * cosY - pz * sinY
    const rz = px * sinY + pz * cosY
    const ry = py * cosX - rz * sinX

    const scale = Math.min(W, H) / 28
    return { sx: W / 2 + rx * scale, sy: H / 2 + ry * scale }
  }

  function draw() {
    ctx.fillStyle = 'rgba(5,5,8,0.15)'
    ctx.fillRect(0, 0, W, H)

    if (points.length < 2) return

    const len = points.length
    for (let i = 1; i < len; i++) {
      const p0 = project(points[i - 1].x, points[i - 1].y, points[i - 1].z)
      const p1 = project(points[i].x, points[i].y, points[i].z)
      const age = i / len
      const alpha = 0.15 + age * age * 0.75
      const hue = 200 + (p1.sy / H) * 160
      ctx.strokeStyle = `hsla(${hue},70%,${45 + age * 20}%,${alpha})`
      ctx.lineWidth = 0.5 + age * 1.5
      ctx.beginPath()
      ctx.moveTo(p0.sx, p0.sy)
      ctx.lineTo(p1.sx, p1.sy)
      ctx.stroke()
    }

    const cur = project(x, y, z)
    ctx.fillStyle = '#ff6060'
    ctx.beginPath()
    ctx.arc(cur.sx, cur.sy, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  function loop() {
    if (autoRotate) rotY += 0.003
    for (let i = 0; i < 8; i++) step()
    draw()
    raf = requestAnimationFrame(loop)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    dragging = true
    lastMX = e.clientX; lastMY = e.clientY
    canvas.setPointerCapture(e.pointerId)
    autoRotate = false
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    rotY += (e.clientX - lastMX) * 0.005
    rotX += (e.clientY - lastMY) * 0.005
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX))
    lastMX = e.clientX; lastMY = e.clientY
  }
  function onPointerUp() { dragging = false }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)

  // Pre-fill trail so it's immediately visible
  resize()
  for (let i = 0; i < 30000; i++) step()
  raf = requestAnimationFrame(loop)

  const controller: ArtifactController = {
    update(next: RosslerConfig) {
      const prev = { ...config }
      config = { ...config, ...next }
      if (next.a !== undefined || next.b !== undefined || next.c !== undefined) {
        resetSim()
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      root.removeChild(canvas)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Rössler Attractor', createRossler)
