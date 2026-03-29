import archiver from 'archiver'
import path from 'node:path'
import fs from 'node:fs'
import { PassThrough } from 'stream'
import { renderDeckHtml } from './html-renderer.js'
import { FRAMEWORK_CSS } from './framework-css.js'

const UPLOAD_DIR = path.resolve(import.meta.dirname ?? '.', '..', '..', 'uploads')

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

  const html = renderDeckHtml(deckName, normalized, theme, files)

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
    archive.append(manifest, { name: `${slug}/manifest.json` })

    if (files?.length) {
      for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file.path)
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `${slug}/assets/${file.filename}` })
        }
      }
    }

    archive.finalize()
  })
}
