import archiver from 'archiver'
import path from 'node:path'
import fs from 'node:fs'
import { PassThrough } from 'stream'
import { renderDeckHtml, getExtractedArtifacts, clearExtractedArtifacts } from './html-renderer.js'
import { NAVIGATION_JS } from './navigation.js'
import { CAROUSEL_JS } from './carousel.js'
import { ARTIFACTS_JS } from './artifacts.js'
import { FRAMEWORK_CSS } from './framework-css.js'

const UPLOAD_DIR = path.resolve(import.meta.dirname ?? '.', '..', '..', 'uploads')
const STATIC_DIR = path.resolve(import.meta.dirname ?? '.', '..', '..', 'static')

interface ExportModule {
  type: string
  zone: string
  data: Record<string, unknown>
  order: number
  stepOrder?: number | null
}

interface ExportSlide {
  id: string
  layout: string
  order: number
  splitRatio?: string
  modules?: ExportModule[]
  blocks?: ExportModule[]
}

interface ExportTheme {
  name: string
  css: string
  fonts: unknown
  colors: unknown
}

interface ExportFile {
  id: string
  filename: string
  path: string
  mimeType: string
}

export async function exportDeckAsZip(
  slug: string,
  slideList: ExportSlide[],
  theme: ExportTheme | null,
  deckName: string,
  files?: ExportFile[],
): Promise<Buffer> {
  // Normalize: accept either modules or blocks array
  const normalized = slideList.map(s => ({
    ...s,
    modules: s.modules || s.blocks || [],
  }))

  // Reset any prior artifact state and render with extraction enabled
  clearExtractedArtifacts()
  const html = renderDeckHtml(deckName, normalized, theme, files, { extractArtifacts: true, externalJs: true })
  const artifacts = getExtractedArtifacts()

  const manifest = JSON.stringify({
    name: deckName,
    slug,
    slideCount: slideList.length,
    theme: theme?.name || 'default',
    exportedAt: new Date().toISOString(),
    generator: 'slide-maker',
  }, null, 2)

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const passThrough = new PassThrough()
    const chunks: Buffer[] = []

    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
    passThrough.on('end', () => resolve(Buffer.concat(chunks)))
    passThrough.on('error', reject)
    archive.on('error', reject)

    archive.pipe(passThrough)

    archive.append(html, { name: `${slug}/index.html` })
    archive.append(FRAMEWORK_CSS, { name: `${slug}/css/styles.css` })
    // Bundle deck engine JS
    const ENGINE_JS = `${NAVIGATION_JS}\n${CAROUSEL_JS}`
    archive.append(ENGINE_JS, { name: `${slug}/js/engine.js` })
    archive.append(ARTIFACTS_JS, { name: `${slug}/js/artifacts.js` })
    archive.append(manifest, { name: `${slug}/manifest.json` })

    // Include extracted artifact files, if any
    // Detect /api/static/ references and bundle those library files
    const staticDeps = new Set<string>()
    if (artifacts.size > 0) {
      for (const [filename, source] of artifacts) {
        for (const m of source.matchAll(/\/api\/static\/([^"'<>\s]+)/g)) {
          staticDeps.add(m[1])
        }
        const rewritten = staticDeps.size > 0
          ? source.replace(/\/api\/static\//g, '../lib/')
          : source
        archive.append(rewritten, { name: `${slug}/artifacts/${filename}` })
      }
    }

    // Bundle static library files referenced by artifacts
    for (const dep of staticDeps) {
      const depPath = path.join(STATIC_DIR, dep)
      if (fs.existsSync(depPath)) {
        archive.file(depPath, { name: `${slug}/lib/${dep}` })
      }
    }

    if (files?.length) {
      for (const file of files) {
        const resolvedPath = path.isAbsolute(file.path) ? file.path : path.resolve(UPLOAD_DIR, file.path)
        // Traversal check: must be inside UPLOAD_DIR or be an absolute path to an existing file
        if (!path.isAbsolute(file.path) && !resolvedPath.startsWith(UPLOAD_DIR + path.sep) && resolvedPath !== UPLOAD_DIR) {
          continue // skip files outside upload directory
        }
        if (fs.existsSync(resolvedPath)) {
          const ext = path.extname(file.filename)
          const assetFilename = file.id + ext
          archive.file(resolvedPath, { name: `${slug}/assets/${assetFilename}` })
        }
      }
    }

    archive.finalize()
  })
}
