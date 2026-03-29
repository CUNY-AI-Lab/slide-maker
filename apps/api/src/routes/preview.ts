import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks, themes } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { renderDeckHtml } from '../export/html-renderer.js'
import { FRAMEWORK_CSS } from '../export/framework-css.js'

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

  // Load theme
  let theme = null
  if (deck.themeId) {
    theme = await db.select().from(themes).where(eq(themes.id, deck.themeId)).get() || null
  }

  // Render HTML — same as export but with inline CSS instead of external file
  const htmlTemplate = renderDeckHtml(deck.name, slidesWithBlocks, theme)

  // Replace the external CSS link with an inline <style> block
  const html = htmlTemplate.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    `<style>${FRAMEWORK_CSS}</style>`
  )

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
})

export default previewRouter
