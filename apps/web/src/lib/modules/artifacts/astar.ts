import type { ArtifactController, ArtifactFactory } from './index'

type AstarConfig = Partial<{
  cellSize: number
  animSpeed: number | string
  mazeOnStart: boolean
}>

const SPEED_MAP: Record<string, number> = {
  slow: 2, medium: 4, fast: 8, instant: 0,
}
function resolveSpeed(v: number | string | undefined): number {
  if (typeof v === 'string') return SPEED_MAP[v] ?? 4
  return typeof v === 'number' ? v : 4
}

const EMPTY = 0, WALL = 1, START = 2, END = 3

const COL = {
  bg: '#0a0a0f',
  empty: '#12121a',
  wall: '#2a2a3a',
  start: '#00e87b',
  end: '#ff4466',
  visitA: 'rgba(60,140,255,0.35)',
  frontierA: 'rgba(60,140,255,0.15)',
  pathA: '#4da6ff',
  visitD: 'rgba(255,160,40,0.35)',
  frontierD: 'rgba(255,160,40,0.15)',
  pathD: '#ffa028',
} as const

export const createAstar: ArtifactFactory = (root: HTMLElement, initialConfig: AstarConfig = {}) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  let W = 0, H = 0, cols = 0, rows = 0, dpr = 1
  let raf = 0

  let config: Required<AstarConfig> = {
    cellSize: 20,
    animSpeed: 4,
    mazeOnStart: true,
    ...initialConfig,
  } as Required<AstarConfig>

  let grid: number[][] = []
  let startCell = { r: 0, c: 0 }
  let endCell = { r: 0, c: 0 }
  let animating = false
  let animId: number | null = null
  let pathA: { r: number; c: number }[] | null = null
  let pathD: { r: number; c: number }[] | null = null
  let visitedA: { r: number; c: number; type: string }[] | null = null
  let visitedD: { r: number; c: number; type: string }[] | null = null
  let mode: 'draw' | 'dragStart' | 'dragEnd' = 'draw'
  let drawing = false
  let drawVal = WALL
  let demoTimer: ReturnType<typeof setTimeout> | null = null

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = root.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function initGrid() {
    const cs = config.cellSize || Math.max(12, Math.min(28, Math.floor(Math.min(W, H) / 40)))
    cols = Math.floor(W / cs)
    rows = Math.floor(H / cs)
    grid = []
    for (let r = 0; r < rows; r++) {
      grid[r] = []
      for (let c = 0; c < cols; c++) grid[r][c] = EMPTY
    }
    startCell = { r: Math.floor(rows / 2), c: Math.floor(cols * 0.15) }
    endCell = { r: Math.floor(rows / 2), c: Math.floor(cols * 0.85) }
    if (startCell.r >= rows) startCell.r = rows - 1
    if (endCell.r >= rows) endCell.r = rows - 1
    if (startCell.c >= cols) startCell.c = cols - 1
    if (endCell.c >= cols) endCell.c = cols - 1
    grid[startCell.r][startCell.c] = START
    grid[endCell.r][endCell.c] = END
    resetAnim()
    render()
  }

  function resetAnim() {
    animating = false
    pathA = null
    pathD = null
    visitedA = null
    visitedD = null
    if (animId != null) { cancelAnimationFrame(animId); animId = null }
  }

  function cellAt(x: number, y: number): { r: number; c: number } | null {
    const cs = config.cellSize || Math.max(12, Math.min(28, Math.floor(Math.min(W, H) / 40)))
    const c = Math.floor(x / cs)
    const r = Math.floor(y / cs)
    if (r >= 0 && r < rows && c >= 0 && c < cols) return { r, c }
    return null
  }

  function heuristic(a: { r: number; c: number }, b: { r: number; c: number }): number {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c)
  }

  function neighbors(r: number, c: number): { r: number; c: number; cost: number }[] {
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    const out: { r: number; c: number; cost: number }[] = []
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] !== WALL) {
        if (dr !== 0 && dc !== 0) {
          if (grid[r + dr][c] === WALL || grid[r][c + dc] === WALL) continue
        }
        out.push({ r: nr, c: nc, cost: dr !== 0 && dc !== 0 ? 1.414 : 1 })
      }
    }
    return out
  }

  function runSearch(useHeuristic: boolean): { frames: { r: number; c: number; type: string }[]; path: { r: number; c: number }[] | null; visited: number } {
    const open: { r: number; c: number; f: number }[] = []
    const gScore: Record<number, number> = {}
    const fScore: Record<number, number> = {}
    const cameFrom: Record<number, number | undefined> = {}
    const closed = new Set<number>()
    const frames: { r: number; c: number; type: string }[] = []
    const key = (r: number, c: number) => r * cols + c
    const sk = key(startCell.r, startCell.c)
    const ek = key(endCell.r, endCell.c)
    gScore[sk] = 0
    fScore[sk] = useHeuristic ? heuristic(startCell, endCell) : 0
    open.push({ r: startCell.r, c: startCell.c, f: fScore[sk] })

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f)
      const cur = open.shift()!
      const ck = key(cur.r, cur.c)
      if (closed.has(ck)) continue
      closed.add(ck)
      frames.push({ r: cur.r, c: cur.c, type: 'visit' })
      if (ck === ek) {
        const path: { r: number; c: number }[] = []
        let k: number | undefined = ek
        while (k !== undefined) {
          path.push({ r: Math.floor(k / cols), c: k % cols })
          k = cameFrom[k]
        }
        path.reverse()
        return { frames, path, visited: closed.size }
      }
      for (const nb of neighbors(cur.r, cur.c)) {
        const nk = key(nb.r, nb.c)
        if (closed.has(nk)) continue
        const tentG = (gScore[ck] || 0) + nb.cost
        if (tentG < (gScore[nk] ?? Infinity)) {
          gScore[nk] = tentG
          fScore[nk] = tentG + (useHeuristic ? heuristic(nb, endCell) : 0)
          cameFrom[nk] = ck
          open.push({ r: nb.r, c: nb.c, f: fScore[nk] })
          frames.push({ r: nb.r, c: nb.c, type: 'frontier' })
        }
      }
    }
    return { frames, path: null, visited: closed.size }
  }

  function render() {
    const cs = config.cellSize || Math.max(12, Math.min(28, Math.floor(Math.min(W, H) / 40)))
    ctx.fillStyle = COL.bg
    ctx.fillRect(0, 0, W, H)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cs, y = r * cs
        ctx.fillStyle = grid[r][c] === WALL ? COL.wall : COL.empty
        ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1)
      }
    }
    if (visitedA) {
      for (const f of visitedA) {
        const x = f.c * cs, y = f.r * cs
        ctx.fillStyle = f.type === 'visit' ? COL.visitA : COL.frontierA
        ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1)
      }
    }
    if (visitedD) {
      for (const f of visitedD) {
        const x = f.c * cs, y = f.r * cs
        ctx.fillStyle = f.type === 'visit' ? COL.visitD : COL.frontierD
        ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1)
      }
    }
    if (pathA && pathA.length > 1) {
      ctx.strokeStyle = COL.pathA; ctx.lineWidth = Math.max(2, cs * 0.3)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pathA[0].c * cs + cs / 2, pathA[0].r * cs + cs / 2)
      for (let i = 1; i < pathA.length; i++) ctx.lineTo(pathA[i].c * cs + cs / 2, pathA[i].r * cs + cs / 2)
      ctx.stroke()
    }
    if (pathD && pathD.length > 1) {
      ctx.strokeStyle = COL.pathD; ctx.lineWidth = Math.max(2, cs * 0.3)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pathD[0].c * cs + cs / 2, pathD[0].r * cs + cs / 2)
      for (let i = 1; i < pathD.length; i++) ctx.lineTo(pathD[i].c * cs + cs / 2, pathD[i].r * cs + cs / 2)
      ctx.stroke()
    }
    const sr = startCell.r * cs + cs / 2, sc = startCell.c * cs + cs / 2
    const er = endCell.r * cs + cs / 2, ec = endCell.c * cs + cs / 2
    ctx.fillStyle = COL.start
    ctx.beginPath(); ctx.arc(sc, sr, cs * 0.35, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = COL.end
    ctx.beginPath(); ctx.arc(ec, er, cs * 0.35, 0, Math.PI * 2); ctx.fill()
  }

  function animateSearch(
    resultA: { frames: { r: number; c: number; type: string }[]; path: { r: number; c: number }[] | null; visited: number } | null,
    resultD: { frames: { r: number; c: number; type: string }[]; path: { r: number; c: number }[] | null; visited: number } | null,
  ) {
    animating = true
    visitedA = []; visitedD = []
    pathA = null; pathD = null
    const framesA = resultA ? resultA.frames : []
    const framesD = resultD ? resultD.frames : []
    const maxLen = Math.max(framesA.length, framesD.length)
    let idx = 0
    const speed = resolveSpeed(config.animSpeed)
    const spd = speed === 0 ? maxLen : speed

    function step() {
      for (let s = 0; s < spd && idx < maxLen; s++, idx++) {
        if (idx < framesA.length) visitedA!.push(framesA[idx])
        if (idx < framesD.length) visitedD!.push(framesD[idx])
      }
      render()
      if (idx >= maxLen) {
        if (resultA) pathA = resultA.path
        if (resultD) pathD = resultD.path
        render()
        animating = false
        return
      }
      animId = requestAnimationFrame(step)
    }
    step()
  }

  function generateMaze() {
    resetAnim()
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = WALL
    const visited = new Set<number>()
    const stack: { r: number; c: number }[] = []
    const sr = 1, sc = 1
    grid[sr][sc] = EMPTY
    visited.add(sr * cols + sc)
    stack.push({ r: sr, c: sc })
    while (stack.length > 0) {
      const cur = stack[stack.length - 1]
      const nbrs: { r: number; c: number; wr: number; wc: number }[] = []
      for (const [dr, dc] of [[0, 2], [2, 0], [0, -2], [-2, 0]]) {
        const nr = cur.r + dr, nc = cur.c + dc
        if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && !visited.has(nr * cols + nc)) {
          nbrs.push({ r: nr, c: nc, wr: cur.r + dr / 2, wc: cur.c + dc / 2 })
        }
      }
      if (nbrs.length === 0) { stack.pop(); continue }
      const next = nbrs[Math.floor(Math.random() * nbrs.length)]
      grid[next.wr][next.wc] = EMPTY
      grid[next.r][next.c] = EMPTY
      visited.add(next.r * cols + next.c)
      stack.push({ r: next.r, c: next.c })
    }
    startCell = { r: 1, c: 1 }
    endCell = { r: rows - 2 - (rows % 2 === 0 ? 1 : 0), c: cols - 2 - (cols % 2 === 0 ? 1 : 0) }
    if (endCell.r >= 0 && endCell.c >= 0 && grid[endCell.r]?.[endCell.c] === WALL) {
      endCell.r--; endCell.c--
    }
    grid[startCell.r][startCell.c] = START
    grid[endCell.r][endCell.c] = END
    render()
  }

  function autoDemo() {
    generateMaze()
    const rA = runSearch(true)
    animateSearch(rA, null)
    const speed = resolveSpeed(config.animSpeed)
    const delay = Math.max(3000, (rA.frames.length / (speed || 8)) * 16 + 3000)
    demoTimer = setTimeout(autoDemo, delay)
  }

  // Pointer interaction
  function onPointerDown(e: PointerEvent) {
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    if (animating) return
    const rect = root.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const cell = cellAt(x, y)
    if (!cell) return
    if (cell.r === startCell.r && cell.c === startCell.c) { mode = 'dragStart'; return }
    if (cell.r === endCell.r && cell.c === endCell.c) { mode = 'dragEnd'; return }
    mode = 'draw'; drawing = true
    resetAnim()
    // stop demo loop on user interaction
    if (demoTimer) { clearTimeout(demoTimer); demoTimer = null }
    drawVal = grid[cell.r][cell.c] === WALL ? EMPTY : WALL
    grid[cell.r][cell.c] = drawVal
    render()
  }

  function onPointerMove(e: PointerEvent) {
    e.preventDefault()
    const rect = root.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const cell = cellAt(x, y)
    if (!cell) return
    if (mode === 'dragStart') {
      if (grid[cell.r][cell.c] !== WALL && !(cell.r === endCell.r && cell.c === endCell.c)) {
        grid[startCell.r][startCell.c] = EMPTY
        startCell = cell
        grid[startCell.r][startCell.c] = START
        resetAnim(); render()
      }
    } else if (mode === 'dragEnd') {
      if (grid[cell.r][cell.c] !== WALL && !(cell.r === startCell.r && cell.c === startCell.c)) {
        grid[endCell.r][endCell.c] = EMPTY
        endCell = cell
        grid[endCell.r][endCell.c] = END
        resetAnim(); render()
      }
    } else if (drawing) {
      if (!(cell.r === startCell.r && cell.c === startCell.c) && !(cell.r === endCell.r && cell.c === endCell.c)) {
        grid[cell.r][cell.c] = drawVal
        render()
      }
    }
  }

  function onPointerUp() {
    drawing = false; mode = 'draw'
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  let prevW = 0, prevH = 0, initialized = false
  const ro = new ResizeObserver(() => {
    const rect = root.getBoundingClientRect()
    const nw = Math.floor(rect.width), nh = Math.floor(rect.height)
    if (nw <= 0 || nh <= 0) return
    if (nw === prevW && nh === prevH) return
    prevW = nw; prevH = nh
    resize()
    if (!initialized) {
      initialized = true
      initGrid()
      if (config.mazeOnStart) {
        demoTimer = setTimeout(autoDemo, 300)
      }
    } else if (!animating && !demoTimer) {
      // only reinit grid on resize if nothing is running
      initGrid()
      if (config.mazeOnStart) {
        demoTimer = setTimeout(autoDemo, 300)
      }
    } else {
      // just resize canvas, don't reset the active demo/animation
      render()
    }
  })
  ro.observe(root)

  const controller: ArtifactController = {
    update(next: AstarConfig) {
      const prev = { ...config }
      config = { ...config, ...next } as Required<AstarConfig>
      if (next.cellSize !== undefined && next.cellSize !== prev.cellSize) {
        initGrid()
      }
    },
    destroy() {
      if (animId != null) cancelAnimationFrame(animId)
      if (demoTimer) clearTimeout(demoTimer)
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
registerArtifact('A* Pathfinding', createAstar)
