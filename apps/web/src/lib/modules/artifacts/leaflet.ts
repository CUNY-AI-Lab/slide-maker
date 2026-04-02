import type { ArtifactController, ArtifactFactory } from './index'

type MarkerDef = { lat: number; lng: number; label?: string; value?: string }

type LeafletConfig = Partial<{
  lat: number
  lng: number
  center: [number, number]
  zoom: number
  style: 'default' | 'dark' | 'light' | 'satellite'
  markers: MarkerDef[]
  tileUrl: string
}>

const TILES: Record<string, string> = {
  default: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}

const TILE = 256
const MIN_ZOOM = 2
const MAX_ZOOM = 18

function lon2x(lon: number, z: number) { return (lon + 180) / 360 * Math.pow(2, z) }
function lat2y(lat: number, z: number) {
  const rad = lat * Math.PI / 180
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z)
}
function x2lon(x: number, z: number) { return x / Math.pow(2, z) * 360 - 180 }
function y2lat(y: number, z: number) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z)
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export const createLeafletMap: ArtifactFactory = (root: HTMLElement, initialConfig: LeafletConfig = {}) => {
  const container = document.createElement('div')
  container.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;background:#0b1220;cursor:grab'
  root.appendChild(container)

  let config = { ...initialConfig }
  let lat = config.center?.[0] ?? (typeof config.lat === 'number' ? config.lat : 40.7128)
  let lng = config.center?.[1] ?? (typeof config.lng === 'number' ? config.lng : -74.006)
  let zoom = Math.max(MIN_ZOOM, Math.min(typeof config.zoom === 'number' ? config.zoom : 4, MAX_ZOOM))
  let tileUrl = config.tileUrl || TILES[config.style || 'default'] || TILES.default
  let markers: MarkerDef[] = Array.isArray(config.markers) ? config.markers : []

  let cx = lon2x(lng, zoom)
  let cy = lat2y(lat, zoom)
  let raf: number | null = null
  let tiles: HTMLImageElement[] = []
  let markerEls: HTMLElement[] = []
  let popup: HTMLElement | null = null

  function clearTiles() {
    for (const t of tiles) t.remove()
    tiles.length = 0
  }

  function clearMarkers() {
    for (const m of markerEls) m.remove()
    markerEls.length = 0
  }

  function removePopup() {
    if (popup) { popup.remove(); popup = null }
  }

  function renderMarkers() {
    clearMarkers()
    removePopup()
    const w = container.clientWidth
    const h = container.clientHeight
    for (const m of markers) {
      const mx = lon2x(m.lng, zoom)
      const my = lat2y(m.lat, zoom)
      const px = (mx - cx) * TILE + w / 2
      const py = (my - cy) * TILE + h / 2
      const dot = document.createElement('div')
      dot.style.cssText = `position:absolute;left:${px - 8}px;top:${py - 8}px;width:16px;height:16px;border-radius:50%;background:#3b82f6;border:2px solid #1e3a8a;cursor:pointer;z-index:2`
      if (m.label) {
        dot.addEventListener('click', (e) => {
          e.stopPropagation()
          removePopup()
          popup = document.createElement('div')
          popup.style.cssText = 'position:absolute;z-index:3;padding:6px 10px;background:rgba(30,41,59,0.9);color:#e2e8f0;border-radius:6px;font:13px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:auto;white-space:nowrap'
          popup.style.left = px + 'px'
          popup.style.top = (py - 12) + 'px'
          popup.style.transform = 'translate(-50%,-100%)'
          const b = document.createElement('b')
          b.style.cssText = 'display:block;font-size:14px;margin-bottom:2px'
          b.textContent = m.label || ''
          popup.appendChild(b)
          if (m.value) {
            const sp = document.createElement('span')
            sp.textContent = m.value
            popup.appendChild(sp)
          }
          container.appendChild(popup)
        })
      }
      container.appendChild(dot)
      markerEls.push(dot)
    }
  }

  function render() {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      const startX = Math.floor(cx - w / (2 * TILE))
      const endX = Math.floor(cx + w / (2 * TILE))
      const startY = Math.floor(cy - h / (2 * TILE))
      const endY = Math.floor(cy + h / (2 * TILE))
      clearTiles()
      const n = Math.pow(2, zoom)
      for (let x = startX - 1; x <= endX + 1; x++) {
        for (let y = startY - 1; y <= endY + 1; y++) {
          if (y < 0 || y >= n) continue
          const img = document.createElement('img')
          img.style.cssText = 'position:absolute;image-rendering:auto'
          const dx = (x - cx) * TILE + w / 2
          const dy = (y - cy) * TILE + h / 2
          img.style.left = dx + 'px'
          img.style.top = dy + 'px'
          img.width = TILE
          img.height = TILE
          const X = ((x % n) + n) % n
          const url = tileUrl.replace('{z}', String(zoom)).replace('{x}', String(X)).replace('{y}', String(y)).replace('{s}', 'a')
          img.referrerPolicy = 'no-referrer'
          img.decoding = 'async'
          img.loading = 'lazy'
          img.draggable = false
          img.src = url
          tiles.push(img)
          container.appendChild(img)
        }
      }
      renderMarkers()
    })
  }

  // Drag to pan
  let dragging = false
  let lastX = 0, lastY = 0

  function onMouseDown(e: MouseEvent) {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    container.style.cursor = 'grabbing'
  }

  function onMouseUp() {
    dragging = false
    container.style.cursor = 'grab'
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    cx -= dx / TILE
    cy -= dy / TILE
    lng = x2lon(cx, zoom)
    lat = y2lat(cy, zoom)
    removePopup()
    render()
  }

  // Scroll to zoom
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const dir = e.deltaY > 0 ? -1 : 1
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + dir))
    if (nz === zoom) return
    const f = Math.pow(2, nz - zoom)
    cx *= f
    cy *= f
    zoom = nz
    lng = x2lon(cx, zoom)
    lat = y2lat(cy, zoom)
    removePopup()
    render()
  }

  container.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  container.addEventListener('wheel', onWheel, { passive: false })
  container.addEventListener('click', removePopup)

  // Resize observer
  const ro = new ResizeObserver(() => render())
  ro.observe(root)

  render()

  const controller: ArtifactController = {
    update(newConfig: LeafletConfig) {
      const prev = config
      config = { ...newConfig }

      const newLat = config.center?.[0] ?? (typeof config.lat === 'number' ? config.lat : lat)
      const newLng = config.center?.[1] ?? (typeof config.lng === 'number' ? config.lng : lng)
      const newZoom = Math.max(MIN_ZOOM, Math.min(typeof config.zoom === 'number' ? config.zoom : zoom, MAX_ZOOM))
      const newTileUrl = config.tileUrl || TILES[config.style || 'default'] || TILES.default
      markers = Array.isArray(config.markers) ? config.markers : markers

      const posChanged = newLat !== lat || newLng !== lng || newZoom !== zoom
      const styleChanged = newTileUrl !== tileUrl

      if (posChanged) {
        lat = newLat; lng = newLng; zoom = newZoom
        cx = lon2x(lng, zoom); cy = lat2y(lat, zoom)
      }
      if (styleChanged) tileUrl = newTileUrl

      if (posChanged || styleChanged || config.markers !== prev.markers) render()
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('click', removePopup)
      root.removeChild(container)
    },
  }

  return controller
}

// Self-register when imported
import { registerArtifact } from './index'
registerArtifact('Leaflet Map', createLeafletMap)
