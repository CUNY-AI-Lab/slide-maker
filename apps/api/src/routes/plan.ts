import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import type { Session, User } from 'lucia'
import {
  type FidelityMode,
  type DeckPlan,
  type PlannedSlide,
  isValidModuleType,
  isValidZoneForLayout,
  MAX_SLIDES_PER_DECK,
  LAYOUTS,
} from '@slide-maker/shared'
import { db, sqlite } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks, uploadedFiles, templates, themes, users, tokenUsage } from '../db/schema.js'
import { gte, sql } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { chatRateLimit } from '../middleware/rate-limit.js'
import { getModelStream, ALL_MODELS } from '../providers/index.js'
import { parseOutline } from '../utils/outline-parser.js'
import { estimateSlideCount } from '../utils/slide-budget.js'
import { buildPlannerPrompt } from '../prompts/planner.js'
import { buildStrictDeckPlan } from '../utils/strict-planner.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

const VALID_FIDELITY: Set<string> = new Set(['strict', 'balanced', 'interpretive'])
const VALID_LAYOUTS = new Set(LAYOUTS)

const planRouter = new Hono<AuthEnv>()
planRouter.use('*', authMiddleware)

// POST /:id/plan — Generate a deck plan from an uploaded outline
planRouter.post('/:id/plan', chatRateLimit, async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')!

  const body = await c.req.json()
  const { fileId, fidelity: rawFidelity, slideRange, modelId } = body

  if (!fileId || !modelId) {
    return c.json({ error: 'fileId and modelId are required' }, 400)
  }

  const fidelity: FidelityMode = VALID_FIDELITY.has(rawFidelity) ? rawFidelity : 'balanced'

  // Check deck access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  // Load deck
  const deck = await db.select().from(decks).where(eq(decks.id, deckId)).get()
  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404)
  }

  // Count existing slides
  const existingSlides = await db.select().from(slides).where(eq(slides.deckId, deckId))
  const existingCount = existingSlides.length

  // Load the uploaded file's markdown sidecar
  const file = await db.select().from(uploadedFiles)
    .where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.deckId, deckId)))
    .get()

  if (!file) {
    return c.json({ error: 'File not found' }, 404)
  }

  // Resolve the markdown sidecar path
  let mdPath: string
  if (file.path && path.isAbsolute(file.path)) {
    mdPath = path.join(path.dirname(file.path), `${file.id}.md`)
  } else if (file.path) {
    mdPath = path.join(UPLOADS_DIR, path.dirname(file.path), `${file.id}.md`)
  } else {
    mdPath = path.join(UPLOADS_DIR, deckId, `${file.id}.md`)
  }

  // For text/markdown files, read the file directly
  let sourceMarkdown = ''
  const mt = (file.mimeType || '').toLowerCase()
  if (mt.includes('markdown') || mt === 'text/plain') {
    const filePath = path.isAbsolute(file.path) ? file.path : path.join(UPLOADS_DIR, file.path)
    try {
      sourceMarkdown = fs.readFileSync(filePath, 'utf8').trim()
    } catch {
      return c.json({ error: 'Could not read source file' }, 500)
    }
  } else if (fs.existsSync(mdPath)) {
    sourceMarkdown = fs.readFileSync(mdPath, 'utf8').trim()
  }

  if (!sourceMarkdown) {
    return c.json({ error: 'No text content extracted from this file. Upload a PDF, DOCX, or Markdown file with text content.' }, 400)
  }

  // Parse outline
  const outlineTree = parseOutline(sourceMarkdown, fileId)

  // Compute budget
  const budget = estimateSlideCount(outlineTree)
  const effectiveBudget = slideRange && typeof slideRange.min === 'number' && typeof slideRange.max === 'number'
    ? { min: Math.max(1, slideRange.min), max: Math.min(MAX_SLIDES_PER_DECK - existingCount, slideRange.max) }
    : { min: budget.min, max: Math.min(MAX_SLIDES_PER_DECK - existingCount, budget.max) }

  // Load templates
  const allTemplates = await db.select().from(templates)
  const templatesList = allTemplates.map(t => ({
    id: t.id,
    name: t.name,
    layout: t.layout,
    modules: (t.modules ?? []) as unknown[],
  }))

  // Load theme
  let activeTheme = null
  if (deck.themeId) {
    const themeRow = await db.select().from(themes).where(eq(themes.id, deck.themeId)).get()
    if (themeRow) {
      activeTheme = { id: themeRow.id, name: themeRow.name, colors: themeRow.colors, fonts: themeRow.fonts }
    }
  }

  let planData: { slides: PlannedSlide[]; omissions: { nodeId: string; reason: string }[] }

  if (fidelity === 'strict') {
    // Strict mode is deterministic — bypass the LLM entirely so outline text
    // can never be paraphrased. See apps/api/src/utils/strict-planner.ts.
    const strict = buildStrictDeckPlan(outlineTree, effectiveBudget)
    planData = { slides: strict.slides, omissions: [...strict.omissions] }
  } else {
    // Build planner prompt
    const systemPrompt = buildPlannerPrompt({
      deckName: deck.name,
      deckId: deck.id,
      sourceMarkdown,
      outlineTree,
      slideBudget: effectiveBudget,
      fidelity,
      templates: templatesList,
      theme: activeTheme,
      existingSlideCount: existingCount,
      maxSlides: MAX_SLIDES_PER_DECK,
    })

    // Check token cap before calling AI
    const provider = (ALL_MODELS.find(m => m.id === modelId)?.provider || 'unknown') as string
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const usage = await db.select({ total: sql<number>`SUM(input_tokens + output_tokens)` })
      .from(tokenUsage)
      .where(and(eq(tokenUsage.userId, user.id), gte(tokenUsage.createdAt, yearStart)))
      .get()
    const userRow = await db.select().from(users).where(eq(users.id, user.id)).get()
    const cap = userRow?.tokenCap ?? 1000000
    if ((usage?.total ?? 0) >= cap) {
      return c.json({ error: 'Token limit reached. Contact an admin.' }, 429)
    }

    // Call AI model and collect full response
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: 'Generate the deck plan from the source document provided in the system prompt. Output ONLY the JSON object.' },
    ]

    let fullResponse = ''
    try {
      const gen = getModelStream(modelId, systemPrompt, messages)
      for await (const text of gen) {
        fullResponse += text
      }
    } catch (err: unknown) {
      console.error('Planner AI error:', err)
      return c.json({ error: 'Failed to generate plan' }, 500)
    }

    // Record token usage
    const userMsgContent = messages[0].content
    const allInputLength = systemPrompt.length + userMsgContent.length
    const inputTokens = Math.ceil(allInputLength / 4)
    const outputTokens = Math.ceil(fullResponse.length / 4)
    await db.insert(tokenUsage).values({
      id: createId(),
      userId: user.id,
      deckId,
      provider,
      model: modelId,
      inputTokens,
      outputTokens,
      createdAt: new Date(),
    })

    // Parse the AI response as JSON
    try {
      let cleaned = fullResponse.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      planData = JSON.parse(cleaned)
    } catch {
      return c.json({ error: 'AI returned invalid JSON. Try again or use a different model.', raw: fullResponse.slice(0, 500) }, 422)
    }
  }

  // Validate plan
  if (!Array.isArray(planData.slides) || planData.slides.length === 0) {
    return c.json({ error: 'AI returned an empty plan' }, 422)
  }

  // Validate and sanitize each slide
  const validatedSlides: PlannedSlide[] = []
  const errors: string[] = []

  for (let i = 0; i < planData.slides.length; i++) {
    const s = planData.slides[i]
    if (!s.layout || !VALID_LAYOUTS.has(s.layout as any)) {
      errors.push(`Slide ${i + 1}: invalid layout "${s.layout}"`)
      continue
    }
    if (Array.isArray(s.modules)) {
      for (const m of s.modules) {
        if (!isValidModuleType(m.type)) {
          errors.push(`Slide ${i + 1}: invalid module type "${m.type}"`)
        }
        if (!isValidZoneForLayout(m.zone, s.layout)) {
          errors.push(`Slide ${i + 1}: zone "${m.zone}" invalid for layout "${s.layout}"`)
        }
      }
    }
    validatedSlides.push({
      ...s,
      planId: s.planId || createId(),
      sourceNodeIds: Array.isArray(s.sourceNodeIds) ? s.sourceNodeIds : [],
      fidelity,
    })
  }

  const plan: DeckPlan = {
    outlineTree,
    estimatedSlideCount: effectiveBudget,
    fidelity,
    slides: validatedSlides,
    omissions: Array.isArray(planData.omissions) ? planData.omissions : [],
  }

  return c.json({
    plan,
    warnings: errors.length > 0 ? errors : undefined,
    hasExistingSlides: existingCount > 0,
  })
})

// POST /:id/plan/apply — Batch-materialize a deck plan into slides
planRouter.post('/:id/plan/apply', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('id')!

  const body = await c.req.json()
  const { plan, outlineFileId } = body as { plan: DeckPlan; outlineFileId?: string }

  if (!plan || !Array.isArray(plan.slides) || plan.slides.length === 0) {
    return c.json({ error: 'Invalid plan: slides array required' }, 400)
  }

  // Check deck access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  // Load the deck so we can merge fidelity/outlineFileId into metadata
  const deckRow = await db.select().from(decks).where(eq(decks.id, deckId)).get()
  if (!deckRow) {
    return c.json({ error: 'Deck not found' }, 404)
  }

  // Count existing slides and validate against limit
  const existingSlides = await db.select().from(slides).where(eq(slides.deckId, deckId))
  const existingCount = existingSlides.length
  const totalAfter = existingCount + plan.slides.length

  if (totalAfter > MAX_SLIDES_PER_DECK) {
    return c.json({
      error: `Plan would create ${plan.slides.length} slides but deck already has ${existingCount} (max ${MAX_SLIDES_PER_DECK}). Remove ${totalAfter - MAX_SLIDES_PER_DECK} slides from the plan.`,
    }, 400)
  }

  // Determine starting order
  const maxOrderRow = sqlite.prepare(
    'SELECT COALESCE(MAX("order"), -1) as max_order FROM slides WHERE deck_id = ?'
  ).get(deckId) as { max_order: number }
  let nextOrder = (maxOrderRow?.max_order ?? -1) + 1

  const now = new Date()
  const createdSlides: { id: string; layout: string; order: number; blocks: { id: string; type: string; zone: string; data: unknown; order: number; stepOrder: number | null; sourceNodeIds: string[] | null }[] }[] = []

  // Merge fidelity + outlineFileId into deck metadata. Only write when the
  // plan actually declares a fidelity — keeps pre-existing metadata intact.
  const currentMetadata = (deckRow.metadata ?? {}) as Record<string, unknown>
  const nextMetadata: Record<string, unknown> = { ...currentMetadata }
  if (plan.fidelity) nextMetadata.fidelity = plan.fidelity
  if (outlineFileId) nextMetadata.outlineFileId = outlineFileId
  const metadataChanged = JSON.stringify(nextMetadata) !== JSON.stringify(currentMetadata)

  // Batch-insert all slides in a single transaction
  const insertAll = sqlite.transaction(() => {
    for (const planned of plan.slides) {
      const slideId = createId()
      const layout = VALID_LAYOUTS.has(planned.layout as any) ? planned.layout : 'layout-split'

      sqlite.prepare(
        'INSERT INTO slides (id, deck_id, layout, split_ratio, "order", notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(slideId, deckId, layout, '0.45', nextOrder, planned.notes ?? null, now.getTime(), now.getTime())

      const blocks: typeof createdSlides[0]['blocks'] = []
      const modules = Array.isArray(planned.modules) ? planned.modules : []

      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i]
        if (!isValidModuleType(mod.type)) continue

        const blockId = createId()
        const zone = mod.zone || 'content'
        const data = mod.data || {}
        const moduleSources = Array.isArray(mod.sourceNodeIds) && mod.sourceNodeIds.length > 0
          ? mod.sourceNodeIds
          : null

        sqlite.prepare(
          'INSERT INTO content_blocks (id, slide_id, type, zone, data, "order", step_order, source_node_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          blockId,
          slideId,
          mod.type,
          zone,
          JSON.stringify(data),
          i,
          mod.stepOrder ?? null,
          moduleSources ? JSON.stringify(moduleSources) : null,
        )

        blocks.push({ id: blockId, type: mod.type, zone, data, order: i, stepOrder: mod.stepOrder ?? null, sourceNodeIds: moduleSources })
      }

      createdSlides.push({ id: slideId, layout, order: nextOrder, blocks })
      nextOrder++
    }

    // Touch deck updated_at (and merged metadata when changed)
    if (metadataChanged) {
      sqlite.prepare('UPDATE decks SET metadata = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(nextMetadata), now.getTime(), deckId)
    } else {
      sqlite.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(now.getTime(), deckId)
    }
  })

  try {
    insertAll()
  } catch (err: unknown) {
    console.error('Plan apply transaction failed:', err)
    return c.json({ error: 'Failed to create slides. No changes were made.' }, 500)
  }

  return c.json({ slides: createdSlides }, 201)
})

export default planRouter
