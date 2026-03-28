import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks, themes } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { exportDeckAsZip } from '../export/index.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const exportRouter = new Hono<AuthEnv>()

exportRouter.use('*', authMiddleware)

// POST /:id/export — Export deck as zip
exportRouter.post('/:id/export', async (c) => {
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
    blocks: (blocksBySlide.get(slide.id) || []).map((b) => ({
      type: b.type,
      data: (typeof b.data === 'string' ? JSON.parse(b.data) : b.data) as Record<string, unknown>,
      order: b.order,
    })),
  }))

  // Load theme
  let theme = null
  if (deck.themeId) {
    theme = await db.select().from(themes).where(eq(themes.id, deck.themeId)).get() || null
  }

  const zipBuffer = await exportDeckAsZip(
    deck.slug,
    slidesWithBlocks,
    theme ? {
      name: theme.name,
      css: theme.css,
      fonts: theme.fonts,
      colors: theme.colors,
    } : null,
    deck.name,
  )

  const filename = `${deck.slug}.zip`

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
})

export default exportRouter
