import archiver from 'archiver'
import { PassThrough } from 'stream'
import { renderDeckHtml } from './html-renderer.js'

const BASE_THEME_CSS = `/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; width: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: #0f0f0f; color: #f0f0f0; }

/* Skip link */
.skip-link {
  position: absolute; top: -100%; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; background: #6366f1; color: #fff; border-radius: 4px;
  text-decoration: none; z-index: 1000; font-size: 14px;
}
.skip-link:focus { top: 8px; }

/* Slide sections */
.slide-section {
  display: none; position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
  padding: 60px 80px; overflow: auto;
  flex-direction: column; justify-content: center; align-items: center;
}
.slide-section.active { display: flex; }

/* Title slide */
.slide-section.title-slide {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
  text-align: center;
}

/* Headings */
h1, h2, h3, h4 { font-family: 'Outfit', sans-serif; line-height: 1.2; margin-bottom: 0.5em; }
h1 { font-size: 3rem; font-weight: 700; }
h2 { font-size: 2.25rem; font-weight: 600; }
h3 { font-size: 1.75rem; font-weight: 600; }
h4 { font-size: 1.25rem; font-weight: 600; }

/* Text block */
.text-block { font-size: 1.25rem; line-height: 1.6; max-width: 800px; margin: 0.5em auto; }

/* Blockquote */
blockquote {
  border-left: 4px solid #6366f1; padding: 16px 24px; margin: 1em auto;
  max-width: 700px; font-style: italic; font-size: 1.3rem;
  background: rgba(99, 102, 241, 0.08); border-radius: 0 8px 8px 0;
}
blockquote cite { display: block; margin-top: 8px; font-size: 0.9rem; opacity: 0.7; font-style: normal; }

/* Code */
.code-wrapper { position: relative; max-width: 800px; margin: 1em auto; }
pre {
  background: #1e1e2e; border-radius: 8px; padding: 20px 24px;
  overflow-x: auto; font-size: 0.95rem; line-height: 1.5;
}
code { font-family: 'Fira Code', 'Courier New', monospace; }
.copy-btn {
  position: absolute; top: 8px; right: 8px; padding: 4px 12px;
  background: rgba(255,255,255,0.1); border: none; border-radius: 4px;
  color: #ccc; cursor: pointer; font-size: 12px;
}
.copy-btn:hover { background: rgba(255,255,255,0.2); }

/* Card grid */
.card-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px; max-width: 900px; margin: 1em auto; width: 100%;
}
.card {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 24px;
}
.card h3 { font-size: 1.1rem; margin-bottom: 8px; }
.card p { font-size: 0.95rem; opacity: 0.8; line-height: 1.5; }

/* Steps */
.steps-block {
  max-width: 700px; margin: 1em auto; padding-left: 24px;
  font-size: 1.15rem; line-height: 1.8;
}
.steps-block li { margin-bottom: 0.3em; }

/* Figure / image */
figure { text-align: center; margin: 1em auto; max-width: 800px; }
figure img { max-width: 100%; max-height: 60vh; border-radius: 8px; object-fit: contain; }
figcaption { margin-top: 8px; font-size: 0.9rem; opacity: 0.6; }

/* Fragment animation */
.fragment { opacity: 0; transform: translateY(10px); transition: opacity 0.4s ease, transform 0.4s ease; }
.fragment.visible { opacity: 1; transform: translateY(0); }

/* Navigation bar */
.slide-nav {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 16px;
  background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
  padding: 8px 20px; border-radius: 999px; z-index: 100;
  font-size: 14px; user-select: none;
}
.slide-nav button {
  background: none; border: none; color: #f0f0f0; font-size: 18px;
  cursor: pointer; padding: 4px 8px; border-radius: 4px;
}
.slide-nav button:hover { background: rgba(255,255,255,0.15); }
#slide-counter { font-variant-numeric: tabular-nums; min-width: 60px; text-align: center; }

/* Overview mode */
.overview-mode { overflow: auto; }
.overview-mode main {
  display: flex; flex-wrap: wrap; gap: 20px; padding: 40px;
  position: relative; height: auto;
}
.overview-mode .slide-section {
  display: flex; position: relative; width: 280px; height: 180px;
  padding: 16px; border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.1); cursor: pointer;
  transform: scale(1); transition: border-color 0.2s;
  font-size: 0.45rem; overflow: hidden;
}
.overview-mode .slide-section:hover { border-color: #6366f1; }
.overview-mode .slide-nav { display: none; }

/* Print styles */
@media print {
  .slide-section { display: flex !important; position: relative !important; page-break-after: always; height: auto; min-height: 100vh; }
  .slide-nav { display: none !important; }
  .skip-link { display: none !important; }
  body { overflow: visible; background: #fff; color: #111; }
}
`

interface ExportSlide {
  id: string
  type: string
  order: number
  fragments: boolean
  blocks: {
    type: string
    data: Record<string, unknown>
    order: number
  }[]
}

interface ExportTheme {
  name: string
  css: string
  fonts: unknown
  colors: unknown
}

export async function exportDeckAsZip(
  slug: string,
  slideList: ExportSlide[],
  theme: ExportTheme | null,
  deckName: string,
): Promise<Buffer> {
  const html = renderDeckHtml(deckName, slideList, theme)

  const themeCss = BASE_THEME_CSS + '\n\n/* Theme overrides */\n' + (theme?.css || '')

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
    archive.append(themeCss, { name: `${slug}/css/theme.css` })
    archive.append(manifest, { name: `${slug}/manifest.json` })

    archive.finalize()
  })
}
