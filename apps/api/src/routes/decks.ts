import { Hono } from 'hono'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import type { Session, User } from 'lucia'
import { generateSlug } from '@slide-maker/shared'
import { db } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

export const decksRouter = new Hono<AuthEnv>()

// All routes require auth
decksRouter.use('*', authMiddleware)

// GET / — List user's decks
decksRouter.get('/', async (c) => {
  const user = c.get('user')

  const accessRows = await db
    .select({ deckId: deckAccess.deckId })
    .from(deckAccess)
    .where(eq(deckAccess.userId, user.id))

  if (accessRows.length === 0) {
    return c.json({ decks: [] })
  }

  const deckIds = accessRows.map((r) => r.deckId)
  const userDecks = await db
    .select()
    .from(decks)
    .where(inArray(decks.id, deckIds))
    .orderBy(desc(decks.updatedAt))

  return c.json({ decks: userDecks })
})

// POST / — Create a deck
decksRouter.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { name, themeId } = body

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const id = createId()
  let slug = generateSlug(name)

  // Check slug uniqueness, append id fragment if collision
  const existing = await db
    .select({ id: decks.id })
    .from(decks)
    .where(eq(decks.slug, slug))
    .get()

  if (existing) {
    slug = `${slug}-${id.slice(0, 8)}`
  }

  const now = new Date()

  await db.insert(decks).values({
    id,
    name,
    slug,
    themeId: themeId || null,
    metadata: {},
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(deckAccess).values({
    deckId: id,
    userId: user.id,
    role: 'owner',
  })

  return c.json({ id, name, slug }, 201)
})

// GET /:id — Get full deck with slides and blocks
decksRouter.get('/:id', async (c) => {
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

  const deckSlides = await db
    .select()
    .from(slides)
    .where(eq(slides.deckId, deckId))
    .orderBy(slides.order)

  const slideIds = deckSlides.map((s) => s.id)
  let blocks: (typeof contentBlocks.$inferSelect)[] = []
  if (slideIds.length > 0) {
    blocks = await db
      .select()
      .from(contentBlocks)
      .where(inArray(contentBlocks.slideId, slideIds))
      .orderBy(contentBlocks.order)
  }

  // Group blocks by slideId
  const blocksBySlide = new Map<string, (typeof contentBlocks.$inferSelect)[]>()
  for (const block of blocks) {
    const arr = blocksBySlide.get(block.slideId) || []
    arr.push(block)
    blocksBySlide.set(block.slideId, arr)
  }

  const slidesWithBlocks = deckSlides.map((slide) => ({
    ...slide,
    blocks: blocksBySlide.get(slide.id) || [],
  }))

  return c.json({ ...deck, slides: slidesWithBlocks })
})

// PATCH /:id — Update deck metadata/theme
decksRouter.patch('/:id', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  if (access.role === 'viewer') {
    return c.json({ error: 'Viewers cannot edit decks' }, 403)
  }

  const body = await c.req.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates.name = body.name
  if (body.themeId !== undefined) updates.themeId = body.themeId
  if (body.metadata !== undefined) updates.metadata = body.metadata

  await db.update(decks).set(updates).where(eq(decks.id, deckId))

  const updated = await db.select().from(decks).where(eq(decks.id, deckId)).get()
  return c.json(updated)
})

// DELETE /:id — Delete deck (owner only)
decksRouter.delete('/:id', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role !== 'owner') {
    return c.json({ error: 'Only the owner can delete a deck' }, 403)
  }

  await db.delete(decks).where(eq(decks.id, deckId))
  return c.json({ message: 'Deck deleted' })
})

// POST /:id/slides — Add a slide
decksRouter.post('/:id/slides', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'No permission to add slides' }, 403)
  }

  const body = await c.req.json()
  const { layout, splitRatio, modules: moduleDefs, insertAfter } = body

  const validLayouts = [
    'title-slide',
    'layout-split',
    'layout-content',
    'layout-grid',
    'layout-full-dark',
    'layout-divider',
    'closing-slide',
  ]
  const slideLayout = validLayouts.includes(layout) ? layout : 'layout-split'

  // Calculate order
  let order: number

  if (insertAfter) {
    // Find the slide to insert after
    const afterSlide = await db
      .select()
      .from(slides)
      .where(and(eq(slides.id, insertAfter), eq(slides.deckId, deckId)))
      .get()

    if (!afterSlide) {
      return c.json({ error: 'insertAfter slide not found' }, 400)
    }

    order = afterSlide.order + 1

    // Shift subsequent slides
    await db
      .update(slides)
      .set({ order: sql`${slides.order} + 1` })
      .where(and(eq(slides.deckId, deckId), sql`${slides.order} >= ${order}`))
  } else {
    // Append to end
    const lastSlide = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${slides.order}), -1)` })
      .from(slides)
      .where(eq(slides.deckId, deckId))
      .get()

    order = (lastSlide?.maxOrder ?? -1) + 1
  }

  const slideId = createId()
  const now = new Date()

  await db.insert(slides).values({
    id: slideId,
    deckId,
    layout: slideLayout,
    splitRatio: splitRatio || '0.45',
    order,
    notes: null,
    createdAt: now,
    updatedAt: now,
  })

  // Create content blocks (modules) if provided
  const createdBlocks: (typeof contentBlocks.$inferSelect)[] = []
  if (moduleDefs && Array.isArray(moduleDefs)) {
    for (let i = 0; i < moduleDefs.length; i++) {
      const mod = moduleDefs[i]
      const blockId = createId()
      const blockRow = {
        id: blockId,
        slideId,
        type: mod.type,
        zone: mod.zone || 'content',
        data: mod.data || {},
        order: i,
        stepOrder: mod.stepOrder ?? null,
      }
      await db.insert(contentBlocks).values(blockRow)
      createdBlocks.push(blockRow)
    }
  }

  // Update deck's updatedAt
  await db.update(decks).set({ updatedAt: now }).where(eq(decks.id, deckId))

  const newSlide = await db.select().from(slides).where(eq(slides.id, slideId)).get()
  return c.json({ ...newSlide, blocks: createdBlocks }, 201)
})

// PATCH /:id/slides/:slideId — Update slide
decksRouter.patch('/:id/slides/:slideId', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')
  const slideId = c.req.param('slideId')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'No permission to edit slides' }, 403)
  }

  const slide = await db
    .select()
    .from(slides)
    .where(and(eq(slides.id, slideId), eq(slides.deckId, deckId)))
    .get()

  if (!slide) {
    return c.json({ error: 'Slide not found' }, 404)
  }

  const body = await c.req.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.notes !== undefined) updates.notes = body.notes
  if (body.splitRatio !== undefined) updates.splitRatio = body.splitRatio
  if (body.layout !== undefined) {
    const validLayouts = [
      'title-slide',
      'layout-split',
      'layout-content',
      'layout-grid',
      'layout-full-dark',
      'layout-divider',
      'closing-slide',
    ]
    if (validLayouts.includes(body.layout)) updates.layout = body.layout
  }

  await db.update(slides).set(updates).where(eq(slides.id, slideId))

  // Update deck's updatedAt
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  const updated = await db.select().from(slides).where(eq(slides.id, slideId)).get()
  return c.json(updated)
})

// DELETE /:id/slides/:slideId — Delete slide and re-order
decksRouter.delete('/:id/slides/:slideId', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')
  const slideId = c.req.param('slideId')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'No permission to delete slides' }, 403)
  }

  const slide = await db
    .select()
    .from(slides)
    .where(and(eq(slides.id, slideId), eq(slides.deckId, deckId)))
    .get()

  if (!slide) {
    return c.json({ error: 'Slide not found' }, 404)
  }

  await db.delete(slides).where(eq(slides.id, slideId))

  // Re-order remaining slides
  await db
    .update(slides)
    .set({ order: sql`${slides.order} - 1` })
    .where(and(eq(slides.deckId, deckId), sql`${slides.order} > ${slide.order}`))

  // Update deck's updatedAt
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  return c.json({ message: 'Slide deleted' })
})

// POST /:id/slides/:slideId/blocks — Add a block to a slide
decksRouter.post('/:id/slides/:slideId/blocks', async (c) => {
  const deckId = c.req.param('id')
  const slideId = c.req.param('slideId')

  const slide = await db
    .select()
    .from(slides)
    .where(and(eq(slides.id, slideId), eq(slides.deckId, deckId)))
    .get()

  if (!slide) {
    return c.json({ error: 'Slide not found' }, 404)
  }

  const body = await c.req.json()
  const { type, data: blockData, zone, stepOrder } = body

  // Get next order
  const lastBlock = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${contentBlocks.order}), -1)` })
    .from(contentBlocks)
    .where(eq(contentBlocks.slideId, slideId))
    .get()

  const blockId = createId()
  const block = {
    id: blockId,
    slideId,
    type,
    zone: zone || 'content',
    data: blockData || {},
    order: (lastBlock?.maxOrder ?? -1) + 1,
    stepOrder: stepOrder ?? null,
  }

  await db.insert(contentBlocks).values(block)
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  return c.json({ block }, 201)
})

// PATCH /:id/slides/:slideId/blocks/:blockId — Update a block
decksRouter.patch('/:id/slides/:slideId/blocks/:blockId', async (c) => {
  const blockId = c.req.param('blockId')
  const deckId = c.req.param('id')

  const body = await c.req.json()
  const { data: blockData, zone, order: blockOrder, stepOrder } = body

  const existing = await db.select().from(contentBlocks).where(eq(contentBlocks.id, blockId)).get()
  if (!existing) {
    return c.json({ error: 'Block not found' }, 404)
  }

  const updates: Record<string, unknown> = {}

  if (blockData !== undefined) {
    const mergedData = { ...(existing.data as Record<string, unknown>), ...blockData }
    updates.data = mergedData
  }

  if (zone !== undefined) {
    updates.zone = zone
  }

  if (blockOrder !== undefined) {
    updates.order = blockOrder
  }

  if (stepOrder !== undefined) {
    updates.stepOrder = stepOrder
  }

  if (Object.keys(updates).length > 0) {
    await db.update(contentBlocks).set(updates).where(eq(contentBlocks.id, blockId))
  }

  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  const updated = await db.select().from(contentBlocks).where(eq(contentBlocks.id, blockId)).get()
  return c.json({ block: updated })
})

// DELETE /:id/slides/:slideId/blocks/:blockId — Remove a block
decksRouter.delete('/:id/slides/:slideId/blocks/:blockId', async (c) => {
  const blockId = c.req.param('blockId')
  const deckId = c.req.param('id')

  await db.delete(contentBlocks).where(eq(contentBlocks.id, blockId))
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  return c.json({ message: 'Block deleted' })
})

// POST /:id/slides/reorder — Reorder slides
decksRouter.post('/:id/slides/reorder', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'No permission to reorder slides' }, 403)
  }

  const body = await c.req.json()
  const { order: slideOrder } = body

  if (!Array.isArray(slideOrder)) {
    return c.json({ error: 'order must be an array of slide IDs' }, 400)
  }

  for (let i = 0; i < slideOrder.length; i++) {
    await db
      .update(slides)
      .set({ order: i })
      .where(and(eq(slides.id, slideOrder[i]), eq(slides.deckId, deckId)))
  }

  // Update deck's updatedAt
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  return c.json({ message: 'Slides reordered' })
})
