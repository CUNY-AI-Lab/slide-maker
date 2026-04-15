import { Hono } from 'hono'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import type { Session, User } from 'lucia'
import {
  buildArtifactBlockData,
  generateSlug,
  LAYOUT_ZONES,
  type ArtifactBlockBuildOptions,
  type JsonValue,
  type SlideLayout,
} from '@slide-maker/shared'
import { db } from '../db/index.js'
import { artifacts, decks, deckAccess, slides, contentBlocks } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const VALID_BLOCK_TYPES = new Set(['heading', 'text', 'card', 'label', 'tip-box', 'prompt-block', 'image', 'carousel', 'comparison', 'card-grid', 'flow', 'stream-list', 'artifact', 'video'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hasExplicitInlineArtifactSource(data: Record<string, unknown>): boolean {
  return isNonEmptyString(data.rawSource) || isNonEmptyString(data.src) || isNonEmptyString(data.url)
}

function getArtifactBuildOptions(data: Record<string, unknown>): ArtifactBlockBuildOptions {
  return {
    alt: isNonEmptyString(data.alt) ? data.alt : undefined,
    width: isNonEmptyString(data.width) ? data.width : undefined,
    height: isNonEmptyString(data.height) ? data.height : undefined,
  }
}

function getArtifactConfig(data: Record<string, unknown>): Record<string, JsonValue> | undefined {
  return isRecord(data.config) ? (data.config as Record<string, JsonValue>) : undefined
}

async function normalizeBlockData(
  type: string,
  data: unknown,
  incomingData?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const normalized = isRecord(data) ? data : {}
  if (type !== 'artifact') return normalized

  if (incomingData && hasExplicitInlineArtifactSource(incomingData)) {
    return normalized
  }

  const registryId = isNonEmptyString(normalized.registryId) ? normalized.registryId : null
  if (registryId) {
    let artifact = await db.select().from(artifacts).where(eq(artifacts.id, registryId)).get()
    if (!artifact && !registryId.startsWith('artifact-')) {
      artifact = await db.select().from(artifacts).where(eq(artifacts.id, `artifact-${registryId}`)).get()
    }
    if (!artifact) {
      throw new Error(`artifact-not-found:${registryId}`)
    }

    return buildArtifactBlockData(
      artifact,
      getArtifactConfig(normalized),
      getArtifactBuildOptions(normalized),
    )
  }

  return normalized
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

  // Validate block types before starting transaction
  if (moduleDefs && Array.isArray(moduleDefs)) {
    for (const mod of moduleDefs) {
      if (!VALID_BLOCK_TYPES.has(mod.type)) {
        return c.json({ error: `Invalid block type: ${mod.type}` }, 400)
      }
    }
  }

  let normalizedModuleDefs = moduleDefs
  if (moduleDefs && Array.isArray(moduleDefs)) {
    try {
      normalizedModuleDefs = await Promise.all(
        moduleDefs.map(async (mod) => ({
          ...mod,
          data: await normalizeBlockData(mod.type, mod.data),
        })),
      )
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('artifact-not-found:')) {
        return c.json({ error: `Artifact not found: ${err.message.slice('artifact-not-found:'.length)}` }, 400)
      }
      throw err
    }
  }

  const slideId = createId()
  const now = new Date()
  const createdBlocks: (typeof contentBlocks.$inferSelect)[] = []

  // Use raw better-sqlite3 sync transaction to prevent slide order race conditions.
  // Drizzle's db.transaction() rejects sync callbacks that contain Drizzle query builders
  // (they return thenables), so we use the raw sqlite .transaction() wrapper instead.
  const { sqlite } = await import('../db/index.js')

  const insertSlide = sqlite.transaction(() => {
    let order: number

    if (insertAfter) {
      const afterSlide = sqlite.prepare(
        'SELECT * FROM slides WHERE id = ? AND deck_id = ?'
      ).get(insertAfter, deckId) as { order: number } | undefined

      if (!afterSlide) {
        throw new Error('insertAfter slide not found')
      }

      order = afterSlide.order + 1

      sqlite.prepare(
        'UPDATE slides SET "order" = "order" + 1 WHERE deck_id = ? AND "order" >= ?'
      ).run(deckId, order)
    } else {
      const row = sqlite.prepare(
        'SELECT COALESCE(MAX("order"), -1) as max_order FROM slides WHERE deck_id = ?'
      ).get(deckId) as { max_order: number }

      order = (row?.max_order ?? -1) + 1
    }

    sqlite.prepare(
      'INSERT INTO slides (id, deck_id, layout, split_ratio, "order", notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(slideId, deckId, slideLayout, splitRatio || '0.45', order, null, now.getTime(), now.getTime())

    if (normalizedModuleDefs && Array.isArray(normalizedModuleDefs)) {
      for (let i = 0; i < normalizedModuleDefs.length; i++) {
        const mod = normalizedModuleDefs[i]
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
        sqlite.prepare(
          'INSERT INTO content_blocks (id, slide_id, type, zone, data, "order", step_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(blockId, slideId, mod.type, mod.zone || 'content', JSON.stringify(mod.data || {}), i, mod.stepOrder ?? null)
        createdBlocks.push(blockRow)
      }
    }

    sqlite.prepare(
      'UPDATE decks SET updated_at = ? WHERE id = ?'
    ).run(now.getTime(), deckId)
  })

  try {
    insertSlide()
  } catch (err) {
    if (err instanceof Error && err.message === 'insertAfter slide not found') {
      return c.json({ error: 'insertAfter slide not found' }, 400)
    }
    throw err
  }

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

  // Remap block zones when layout changes
  if (body.layout && body.layout !== slide.layout) {
    const newLayout = body.layout as SlideLayout
    const validZones = LAYOUT_ZONES[newLayout] || []
    if (validZones.length > 0) {
      const primaryZone = validZones[0]
      const blocks = await db.select().from(contentBlocks).where(eq(contentBlocks.slideId, slideId)).all()
      for (const block of blocks) {
        if (!validZones.includes(block.zone as any)) {
          await db.update(contentBlocks).set({ zone: primaryZone }).where(eq(contentBlocks.id, block.id))
        }
      }
    }
  }

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

  const user = c.get('user')

  // Check deck access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Forbidden' }, 403)
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
  const { type, data: blockData, zone, stepOrder } = body

  if (!VALID_BLOCK_TYPES.has(type)) {
    return c.json({ error: 'Invalid block type' }, 400)
  }

  let normalizedBlockData: Record<string, unknown>
  try {
    normalizedBlockData = await normalizeBlockData(type, blockData)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('artifact-not-found:')) {
      return c.json({ error: `Artifact not found: ${err.message.slice('artifact-not-found:'.length)}` }, 400)
    }
    throw err
  }

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
    data: normalizedBlockData,
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

  const user = c.get('user')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.json()
  const { data: blockData, zone, order: blockOrder, stepOrder } = body

  const slideId = c.req.param('slideId')

  const existing = await db.select().from(contentBlocks).where(eq(contentBlocks.id, blockId)).get()
  if (!existing || existing.slideId !== slideId) {
    return c.json({ error: 'Block not found' }, 404)
  }

  // Verify slide belongs to this deck
  const slide = await db.select().from(slides).where(and(eq(slides.id, slideId), eq(slides.deckId, deckId))).get()
  if (!slide) {
    return c.json({ error: 'Block not found' }, 404)
  }

  const updates: Record<string, unknown> = {}

  if (blockData !== undefined) {
    const incomingBlockData = isRecord(blockData) ? blockData : {}
    const mergedData = { ...(existing.data as Record<string, unknown>), ...incomingBlockData }
    if (existing.type === 'text' && 'markdown' in incomingBlockData) {
      delete mergedData.html
    }
    try {
      updates.data = await normalizeBlockData(existing.type, mergedData, incomingBlockData)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('artifact-not-found:')) {
        return c.json({ error: `Artifact not found: ${err.message.slice('artifact-not-found:'.length)}` }, 400)
      }
      throw err
    }
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

  const user = c.get('user')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const slideId = c.req.param('slideId')

  // Verify block belongs to this slide and slide belongs to this deck
  const existing = await db.select().from(contentBlocks).where(eq(contentBlocks.id, blockId)).get()
  if (!existing || existing.slideId !== slideId) {
    return c.json({ error: 'Block not found' }, 404)
  }
  const slide = await db.select().from(slides).where(and(eq(slides.id, slideId), eq(slides.deckId, deckId))).get()
  if (!slide) {
    return c.json({ error: 'Block not found' }, 404)
  }

  await db.delete(contentBlocks).where(eq(contentBlocks.id, blockId))
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  return c.json({ message: 'Block deleted' })
})

// POST /:id/slides/:slideId/blocks/reorder — Batch reorder blocks within a slide
decksRouter.post('/:id/slides/:slideId/blocks/reorder', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')
  const slideId = c.req.param('slideId')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'No permission to reorder blocks' }, 403)
  }

  const body = await c.req.json()
  const { order: blockOrder } = body

  if (!Array.isArray(blockOrder)) {
    return c.json({ error: 'order must be an array of block IDs' }, 400)
  }

  for (let i = 0; i < blockOrder.length; i++) {
    await db
      .update(contentBlocks)
      .set({ order: i })
      .where(and(eq(contentBlocks.id, blockOrder[i]), eq(contentBlocks.slideId, slideId)))
  }

  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  return c.json({ message: 'Blocks reordered' })
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

// POST /:id/blocks/:blockId/move — Atomically move a block to another slide (and/or zone)
decksRouter.post('/:id/blocks/:blockId/move', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')
  const blockId = c.req.param('blockId')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'No permission to move blocks' }, 403)
  }

  const body = await c.req.json().catch(() => ({}))
  const toSlideId = String(body?.toSlideId || '')
  const toZone = String(body?.toZone || '')
  let toIndex = typeof body?.toIndex === 'number' ? (body.toIndex as number) : undefined

  if (!toSlideId || !toZone) {
    return c.json({ error: 'toSlideId and toZone are required' }, 400)
  }

  // Verify block and slide ownership and gather positions
  const existing = await db.select().from(contentBlocks).where(eq(contentBlocks.id, blockId)).get()
  if (!existing) {
    return c.json({ error: 'Block not found' }, 404)
  }

  const srcSlide = await db.select().from(slides).where(eq(slides.id, existing.slideId)).get()
  const destSlide = await db.select().from(slides).where(eq(slides.id, toSlideId)).get()
  if (!srcSlide || !destSlide || srcSlide.deckId !== deckId || destSlide.deckId !== deckId) {
    return c.json({ error: 'Block or target slide not found' }, 404)
  }

  const { sqlite } = await import('../db/index.js')

  const moveTx = sqlite.transaction(() => {
    const srcOrder = existing.order
    const srcZone = existing.zone || 'content'

    // Clamp destination index within the destination zone length
    if (toIndex === undefined || toIndex === null) {
      const row = sqlite.prepare(
        'SELECT COUNT(1) as cnt FROM content_blocks WHERE slide_id = ? AND zone = ?'
      ).get(toSlideId, toZone) as { cnt: number }
      toIndex = row?.cnt ?? 0
    } else if (toIndex < 0) {
      toIndex = 0
    } else {
      const row = sqlite.prepare(
        'SELECT COUNT(1) as cnt FROM content_blocks WHERE slide_id = ? AND zone = ?'
      ).get(toSlideId, toZone) as { cnt: number }
      const max = row?.cnt ?? 0
      if (toIndex > max) toIndex = max
    }

    if (existing.slideId === toSlideId && srcZone === toZone) {
      // Intra-slide reorder within same zone
      if (toIndex === srcOrder) return
      if (toIndex > srcOrder) {
        sqlite.prepare(
          'UPDATE content_blocks SET "order" = "order" - 1 WHERE slide_id = ? AND zone = ? AND "order" > ? AND "order" <= ?'
        ).run(toSlideId, toZone, srcOrder, toIndex)
      } else {
        sqlite.prepare(
          'UPDATE content_blocks SET "order" = "order" + 1 WHERE slide_id = ? AND zone = ? AND "order" >= ? AND "order" < ?'
        ).run(toSlideId, toZone, toIndex, srcOrder)
      }
      sqlite.prepare(
        'UPDATE content_blocks SET "order" = ? WHERE id = ?'
      ).run(toIndex, blockId)
    } else {
      // Cross-slide or cross-zone move
      // Make room in destination zone
      sqlite.prepare(
        'UPDATE content_blocks SET "order" = "order" + 1 WHERE slide_id = ? AND zone = ? AND "order" >= ?'
      ).run(toSlideId, toZone, toIndex)
      // Compact source zone after removal
      sqlite.prepare(
        'UPDATE content_blocks SET "order" = "order" - 1 WHERE slide_id = ? AND zone = ? AND "order" > ?'
      ).run(existing.slideId, srcZone, srcOrder)
      // Move the block
      sqlite.prepare(
        'UPDATE content_blocks SET slide_id = ?, zone = ?, "order" = ? WHERE id = ?'
      ).run(toSlideId, toZone, toIndex, blockId)
    }

    // Touch deck updated_at
    sqlite.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(Date.now(), deckId)
  })

  try {
    moveTx()
  } catch (err) {
    return c.json({ error: 'Move failed' }, 500)
  }

  const updated = await db.select().from(contentBlocks).where(eq(contentBlocks.id, blockId)).get()
  return c.json({ block: updated })
})
