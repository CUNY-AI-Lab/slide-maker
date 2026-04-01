import type { ArtifactController, ArtifactFactory } from './index'

type SprottConfig = Partial<{
  system: string
  trailLength: number
  autoRotate: boolean
}>

type System = {
  name: string
  init: [number, number, number]
  scale: number
  fn: (x: number, y: number, z: number) => [number, number, number]
}

const SYSTEMS: System[] = [
  {
    name: 'Thomas',
    init: [0.1, 0, 0],
    scale: 0.22,
    fn: (x, y, z) => [Math.sin(y) - 0.208186 * x, Math.sin(z) - 0.208186 * y, Math.sin(x) - 0.208186 * z],
  },
  {
    name: 'Dadras',
    init: [1, 2, 3],
    scale: 0.18,
    fn: (x, y, z) => [y - 3 * x + 2.7 * y * z, 1.7 * y - x * z + z, 2 * x * y - 9 * z],
  },
  {
    name: 'Halvorsen',
    init: [-5, 0, 1],
    scale: 0.13,
    fn: (x, y, z) => [-1.4 * x - 4 * y - 4 * z - y * y, -1.4 * y - 4 * z - 4 * x - z * z, -1.4 * z - 4 * x - 4 * y - x * x],
  },
  {
    name: 'Sprott B',
    init: [0.1, 0.1, 0.1],
    scale: 0.42,
    fn: (x, y, z) => [y * z, x - y, 1 - x * y],
  },
  {
    name: 'Sprott C',
    init: [0.1, 0.1, 0.1],
    scale: 0.45,
    fn: (x, y, z) => [y * z, x - y, 1 - x * x],
  },
  {
    name: 'Aizawa',
    init: [0.1, 1, 0.01],
    scale: 0.85,
    fn: (x, y, z) => [
      (z - 0.7) * x - 3.5 * y,
      3.5 * x + (z - 0.7) * y,
      0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x,
    ],
  },
  {
    name: 'Sprott D',
    init: [0, 0, 1],
    scale: 0.38,
    fn: (x, y, z) => [-y, x + z, x * z + 3 * y * y],
  },
  {
    name: 'Four-Wing',
    init: [1, 1, 1],
    scale: 0.5,
    fn: (x, y, z) => [0.2 * x + y * z, 0.01 * y - x * z, -x * y - z],
  },
  {
    name: 'Linz-Sprott',
    init: [0.1, 0, 0],
    scale: 0.55,
    fn: (x, y, z) => [y, -x + y * z, 1 - y * y],
  },
]

function rk4(fn: System['fn'], x: number, y: number, z: number, dt: number): [number, number, number] {
  const [k1x, k1y, k1z] = fn(x, y, z)
  const [k2x, k2y, k2z] = fn(x + dt / 2 * k1x, y + dt / 2 * k1y, z + dt / 2 * k1z)
  const [k3x, k3y, k3z] = fn(x + dt / 2 * k2x, y + dt / 2 * k2y, z + dt / 2 * k2z)
  const [k4x, k4y, k4z] = fn(x + dt * k3x, y + dt * k3y, z + dt * k3z)
  return [
    x + dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x),
    y + dt / 6 * (k1y + 2 * k2y + 2 * k3y + k4y),
    z + dt / 6 * (k1z + 2 * k2z + 2 * k3z + k4z),
  ]
}

export const createSprott: ArtifactFactory = (root: HTMLElement, initialConfig: SprottConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0
  let raf = 0

  let config: Required<SprottConfig> = {
    system: 'Thomas',
    trailLength: 60000,
    autoRotate: true,
    ...initialConfig,
  } as any

  let sysIdx = SYSTEMS.findIndex((s) => s.name === config.system)
  if (sysIdx < 0) sysIdx = 0

  let px = 0, py = 0, pz = 0
  let trail: [number, number, number][] = []

  let rotX = 0.4, rotY = 0.3
  let autoAngle = 0
  let dragging = false, lastPX = 0, lastPY = 0

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function resetSystem() {
    const sys = SYSTEMS[sysIdx]
    px = sys.init[0] + (Math.random() - 0.5) * 0.001
    py = sys.init[1] + (Math.random() - 0.5) * 0.001
    pz = sys.init[2] + (Math.random() - 0.5) * 0.001
    trail = []
    const dt = 0.004
    for (let i = 0; i < 2000; i++) {
      ;[px, py, pz] = rk4(sys.fn, px, py, pz, dt)
      if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) {
        px = sys.init[0]; py = sys.init[1]; pz = sys.init[2]
      }
    }
  }

  function project(x: number, y: number, z: number): [number, number] {
    const ry = config.autoRotate ? autoAngle : rotY
    const cosY = Math.cos(ry), sinY = Math.sin(ry)
    const rx = rotX
    const cosX = Math.cos(rx), sinX = Math.sin(rx)

    const x1 = x * cosY - z * sinY
    const z1 = x * sinY + z * cosY
    const y1 = y * cosX - z1 * sinX

    const scale = SYSTEMS[sysIdx].scale * Math.min(W, H) * 0.45
    return [W / 2 + x1 * scale, H / 2 + y1 * scale]
  }

  function frame() {
    const sys = SYSTEMS[sysIdx]
    const dt = 0.004
    const stepsPerFrame = 4

    ctx.fillStyle = 'rgba(8,8,16,0.05)'
    ctx.fillRect(0, 0, W, H)

    if (config.autoRotate) autoAngle += 0.003

    for (let s = 0; s < stepsPerFrame; s++) {
      ;[px, py, pz] = rk4(sys.fn, px, py, pz, dt)
      if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) { resetSystem(); return }
      trail.push([px, py, pz])
      if (trail.length > config.trailLength) trail.shift()
    }

    const len = trail.length
    if (len < 2) { raf = requestAnimationFrame(frame); return }

    for (let i = 1; i < len; i++) {
      const t = i / len
      const hue = (200 + t * 200) % 360
      const alpha = 0.15 + t * 0.55
      const [x0, y0] = project(trail[i - 1][0], trail[i - 1][1], trail[i - 1][2])
      const [x1, y1] = project(trail[i][0], trail[i][1], trail[i][2])
      if (Math.hypot(x1 - x0, y1 - y0) > Math.min(W, H) * 0.15) continue
      ctx.beginPath()
      ctx.strokeStyle = `hsla(${hue},80%,65%,${alpha})`
      ctx.lineWidth = 1
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }

    const [hx, hy] = project(px, py, pz)
    ctx.beginPath()
    ctx.arc(hx, hy, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()

    raf = requestAnimationFrame(frame)
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true
    lastPX = e.clientX; lastPY = e.clientY
    canvas.setPointerCapture(e.pointerId)
    if (config.autoRotate) {
      config = { ...config, autoRotate: false }
      rotY = autoAngle
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - lastPX, dy = e.clientY - lastPY
    rotY += dx * 0.005
    rotX += dy * 0.005
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX))
    lastPX = e.clientX; lastPY = e.clientY
  }
  function onPointerUp() { dragging = false }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  const ro = new ResizeObserver(() => { resize() })
  ro.observe(root)

  resize()
  resetSystem()

  // Pre-fill trail so it's immediately visible
  const sys = SYSTEMS[sysIdx]
  const dt = 0.004
  for (let i = 0; i < 20000; i++) {
    ;[px, py, pz] = rk4(sys.fn, px, py, pz, dt)
    if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) {
      px = sys.init[0]; py = sys.init[1]; pz = sys.init[2]
    }
    trail.push([px, py, pz])
    if (trail.length > config.trailLength) trail.shift()
  }

  raf = requestAnimationFrame(frame)

  const controller: ArtifactController = {
    update(next: SprottConfig) {
      const systemChanged = next.system !== undefined && next.system !== config.system
      config = { ...config, ...next }
      if (systemChanged) {
        sysIdx = SYSTEMS.findIndex((s) => s.name === config.system)
        if (sysIdx < 0) sysIdx = 0
        resetSystem()
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
registerArtifact('Sprott Attractor', createSprott)
