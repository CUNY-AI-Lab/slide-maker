import { describe, it, expect } from 'vitest'

// Minimal ZIP central directory parser to list filenames without extra deps
function listZipFilenames(buf: Buffer): string[] {
  const sigEOCD = 0x06054b50
  const sigCFH = 0x02014b50
  // Find End of Central Directory by scanning backwards
  let eocdOffset = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === sigEOCD) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) throw new Error('EOCD not found')
  const centralSize = buf.readUInt32LE(eocdOffset + 12)
  const centralOffset = buf.readUInt32LE(eocdOffset + 16)
  const end = centralOffset + centralSize
  const names: string[] = []
  let ptr = centralOffset
  while (ptr + 46 <= end && buf.readUInt32LE(ptr) === sigCFH) {
    // central file header fixed part is 46 bytes
    const fileNameLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const commentLen = buf.readUInt16LE(ptr + 32)
    const nameStart = ptr + 46
    const nameEnd = nameStart + fileNameLen
    const name = buf.subarray(nameStart, nameEnd).toString('utf8')
    names.push(name)
    ptr = nameEnd + extraLen + commentLen
  }
  return names
}

describe('export ZIP integration', () => {
  it('includes extracted artifact files and references them from index.html', async () => {
    const { exportDeckAsZip } = await import('../apps/api/src/export/index')
    const { renderDeckHtml, getExtractedArtifacts, clearExtractedArtifacts } = await import(
      '../apps/api/src/export/html-renderer'
    )

    const slug = 'deck-test'
    const deckName = 'Deck Test'
    const slides = [
      {
        id: 's1',
        layout: 'layout-content',
        order: 0,
        modules: [
          {
            type: 'artifact',
            zone: 'main',
            order: 0,
            data: {
              rawSource: '<!doctype html><html><head><meta charset="utf-8"></head><body><script>console.log("ok")</script></body></html>',
              alt: 'Viz',
            },
          },
        ],
      },
    ] as any

    // Render HTML to capture artifact filenames
    clearExtractedArtifacts()
    const html = renderDeckHtml(deckName, slides, null as any, [], { extractArtifacts: true })
    const artifacts = Array.from(getExtractedArtifacts().entries())
    expect(artifacts.length).toBe(1)
    const [filename, source] = artifacts[0]
    expect(filename).toMatch(/^artifact-[A-Za-z0-9_-]{1,20}\.html$/)
    expect(source.length).toBeGreaterThan(10)
    expect(html).toContain(`src="artifacts/${filename}`)

    // Build ZIP and list filenames
    const zip = await exportDeckAsZip(slug, slides, null as any, deckName, [])
    const names = listZipFilenames(zip)
    // basic contents
    expect(names).toContain(`${slug}/index.html`)
    expect(names).toContain(`${slug}/css/styles.css`)
    expect(names).toContain(`${slug}/manifest.json`)
    // artifact file present
    expect(names).toContain(`${slug}/artifacts/${filename}`)
  })
})

