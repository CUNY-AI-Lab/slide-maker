import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks, themes } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { renderDeckHtml } from '../export/html-renderer.js'
import { FRAMEWORK_CSS } from '../export/framework-css.js'
import { resolveArtifactSources } from '../utils/resolve-artifacts.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const previewRouter = new Hono<AuthEnv>()

previewRouter.use('*', authMiddleware)

// GET /:id/preview — Render deck as full HTML page (live preview)
previewRouter.get('/:id/preview', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')

  // Check access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  const deck = await db.select().from(decks).where(eq(decks.id, deckId)).get()
  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404)
  }

  // Load slides
  const deckSlides = await db
    .select()
    .from(slides)
    .where(eq(slides.deckId, deckId))
    .orderBy(slides.order)

  // Load blocks
  const slideIds = deckSlides.map((s) => s.id)
  let blocks: (typeof contentBlocks.$inferSelect)[] = []
  if (slideIds.length > 0) {
    blocks = await db
      .select()
      .from(contentBlocks)
      .where(inArray(contentBlocks.slideId, slideIds))
      .orderBy(contentBlocks.order)
  }

  // Group blocks by slide
  const blocksBySlide = new Map<string, (typeof contentBlocks.$inferSelect)[]>()
  for (const block of blocks) {
    const arr = blocksBySlide.get(block.slideId) || []
    arr.push(block)
    blocksBySlide.set(block.slideId, arr)
  }

  const slidesWithBlocks = deckSlides.map((slide) => ({
    ...slide,
    modules: (blocksBySlide.get(slide.id) || []).map((b) => ({
      type: b.type,
      zone: b.zone || 'content',
      data: (typeof b.data === 'string' ? JSON.parse(b.data) : b.data) as Record<string, unknown>,
      order: b.order,
      stepOrder: b.stepOrder ?? null,
    })),
  }))

  // Resolve artifact sources from catalog for blocks missing rawSource
  await resolveArtifactSources(slidesWithBlocks.flatMap(s => s.modules))

  // Load theme
  let theme = null
  if (deck.themeId) {
    theme = await db.select().from(themes).where(eq(themes.id, deck.themeId)).get() || null
  }

  // Render HTML for preview. No artifactEndpoint — artifacts use srcdoc iframes
  // instead of the /api/artifact?b64= GET endpoint, which breaks for large artifacts
  // (Frappe charts etc. produce 90KB+ base64 URLs exceeding browser limits).
  // Derive base path from PUBLIC_URL (same logic as svelte.config.js).
  const basePath = process.env.PUBLIC_URL?.includes('/slide-maker') ? '/slide-maker' : ''
  const htmlTemplate = renderDeckHtml(deck.name, slidesWithBlocks, theme)

  // Replace the external CSS link with an inline <style> block
  // Rewrite /api/ URLs to include the base path so images resolve behind the proxy
  let html = htmlTemplate.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    `<style>${FRAMEWORK_CSS}</style>`
  )
  if (basePath) {
    html = html.replace(/src="\/api\//g, `src="${basePath}/api/`)
  }


  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https: http://localhost:*; frame-src 'self' blob: https://www.youtube.com https://player.vimeo.com https://www.loom.com; object-src 'none'; frame-ancestors 'none';",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

export default previewRouter
