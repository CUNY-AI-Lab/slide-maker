import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, and, inArray, gte, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks, chatMessages, templates, themes, uploadedFiles, users, tokenUsage, artifacts } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { chatRateLimit } from '../middleware/rate-limit.js'
import { getModelStream } from '../providers/index.js'
import { buildSystemPrompt } from '../prompts/system.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const chat = new Hono<AuthEnv>()

chat.use('*', authMiddleware)

// POST / — Stream chat response via SSE
chat.post('/', chatRateLimit, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { message, deckId, activeSlideId, modelId, history } = body

  if (!message || !deckId || !modelId) {
    return c.json({ error: 'message, deckId, and modelId are required' }, 400)
  }

  // Check deck access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  // Load full deck state
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

  const blocksBySlide = new Map<string, (typeof contentBlocks.$inferSelect)[]>()
  for (const block of blocks) {
    const arr = blocksBySlide.get(block.slideId) || []
    arr.push(block)
    blocksBySlide.set(block.slideId, arr)
  }

  const slidesWithBlocks = deckSlides.map((slide) => ({
    ...slide,
    blocks: (blocksBySlide.get(slide.id) || []).map((b) => ({
      id: b.id,
      slideId: b.slideId,
      type: b.type,
      zone: b.zone ?? 'content',
      data: (b.data ?? {}) as Record<string, unknown>,
      order: b.order,
      stepOrder: b.stepOrder ?? null,
    })),
  }))

  // Load uploaded files for context
  const deckFiles = await db.select().from(uploadedFiles).where(eq(uploadedFiles.deckId, deckId))
  // Attempt to attach short Markdown excerpts for PDFs/DOCX if present
  const filesList = (() => {
    const list = deckFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      url: `/api/decks/${deckId}/files/${f.id}`,
      path: f.path as string,
    }))

    // Compute sidecar .md path and load excerpts
    const MAX_TOTAL = 4000
    const candidates = list.filter((f) => f.mimeType?.includes('pdf') || f.mimeType?.includes('word'))
    let perDoc = candidates.length > 0 ? Math.floor(MAX_TOTAL / candidates.length) : 0
    if (perDoc < 1200) perDoc = 1200

    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

      for (const f of list) {
        if (!(f.mimeType?.includes('pdf') || f.mimeType?.includes('word'))) continue
        let mdPath: string
        if (f.path && path.isAbsolute(f.path)) {
          mdPath = path.join(path.dirname(f.path), `${f.id}.md`)
        } else if (f.path) {
          mdPath = path.join(UPLOADS_DIR, path.dirname(f.path), `${f.id}.md`)
        } else {
          mdPath = path.join(UPLOADS_DIR, deckId, `${f.id}.md`)
        }
        try {
          if (fs.existsSync(mdPath)) {
            const md = fs.readFileSync(mdPath, 'utf8').trim()
            ;(f as any).excerpt = md.length > perDoc ? md.slice(0, perDoc) + '\n\n…' : md
          }
        } catch {}
      }
    } catch {}

    // Strip internal path before returning
    return list.map(({ path: _p, ...rest }) => rest)
  })()

  // Load templates
  const allTemplates = await db.select().from(templates)
  const templatesList = allTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    layout: t.layout,
    modules: (t.modules ?? []) as unknown[],
  }))

  // Load active theme
  let activeTheme = null
  if (deck.themeId) {
    const themeRow = await db.select().from(themes).where(eq(themes.id, deck.themeId)).get()
    if (themeRow) {
      activeTheme = {
        id: themeRow.id,
        name: themeRow.name,
        colors: themeRow.colors,
        fonts: themeRow.fonts,
      }
    }
  }

  // Load available artifacts (include config for tiered prompt)
  const allArtifacts = await db.select().from(artifacts)
  const artifactsList = allArtifacts.map((a) => {
    const cfg = (a.config ?? {}) as Record<string, unknown>
    const paramCount = Object.values(cfg).filter(
      (v) => v && typeof v === 'object' && 'default' in (v as Record<string, unknown>),
    ).length
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      type: a.type,
      config: cfg,
      paramCount,
    }
  })

  // Compute active artifacts (those placed in deck slides)
  const activeArtifactsMap = new Map<string, { name: string; slidePositions: number[]; config: Record<string, unknown> }>()
  for (const slide of slidesWithBlocks) {
    for (const block of slide.blocks) {
      if (block.type !== 'artifact') continue
      const d = block.data as Record<string, unknown>
      const name = String(d.artifactName || d.alt || '').trim()
      if (!name) continue
      const existing = activeArtifactsMap.get(name.toLowerCase())
      if (existing) {
        existing.slidePositions.push(slide.order)
      } else {
        activeArtifactsMap.set(name.toLowerCase(), {
          name,
          slidePositions: [slide.order],
          config: (d.config as Record<string, unknown>) || {},
        })
      }
    }
  }
  const activeArtifactsList = Array.from(activeArtifactsMap.values())

  // Detect @artifact: references in user message for focused tier
  const atRefs = [...message.matchAll(/@artifact:([^\n@]+)/gi)].map((m) => m[1].trim())

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    deck: {
      id: deck.id,
      name: deck.name,
      themeId: deck.themeId,
      slides: slidesWithBlocks,
    },
    activeSlideId: activeSlideId || null,
    templates: templatesList,
    theme: activeTheme,
    files: filesList,
    artifacts: artifactsList,
    activeArtifacts: activeArtifactsList,
    focusedArtifactNames: atRefs.length > 0 ? atRefs : undefined,
  })

  // Prepare messages for the LLM
  // Reconstruct chat history server-side from DB (never trust client-supplied history)
  const dbMessages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.deckId, deckId))
    .orderBy(chatMessages.createdAt)

  const chatHistory: { role: 'user' | 'assistant'; content: string }[] = dbMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  chatHistory.push({ role: 'user', content: message })

  // Determine provider from model
  const model = modelId.includes('/') ? 'openrouter' : 'anthropic'

  // Check token cap
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

  // Save user message to DB
  const userMsgId = createId()
  const now = new Date()
  await db.insert(chatMessages).values({
    id: userMsgId,
    deckId,
    role: 'user',
    content: message,
    provider: model,
    createdAt: now,
  })

  // Stream response
  return streamSSE(c, async (stream) => {
    let fullResponse = ''
    const streamTimeout = setTimeout(() => { stream.close() }, 120_000) // 2 min hard cap

    try {
      const gen = getModelStream(modelId, systemPrompt, chatHistory)

      for await (const text of gen) {
        fullResponse += text
        await stream.writeSSE({
          data: JSON.stringify({ type: 'text', content: text }),
        })
      }

      await stream.writeSSE({
        data: JSON.stringify({ type: 'done' }),
      })

      // Save assistant message to DB
      const assistantMsgId = createId()
      await db.insert(chatMessages).values({
        id: assistantMsgId,
        deckId,
        role: 'assistant',
        content: fullResponse,
        provider: model,
        createdAt: new Date(),
      })

      // Estimate and record token usage
      const inputTokens = Math.ceil((systemPrompt.length + message.length) / 4)
      const outputTokens = Math.ceil(fullResponse.length / 4)
      await db.insert(tokenUsage).values({
        id: createId(),
        userId: user.id,
        deckId,
        provider: model,
        model: modelId,
        inputTokens,
        outputTokens,
        createdAt: new Date(),
      })
    } catch (err: unknown) {
      console.error('AI streaming error:', err)
      const errorMessage = 'An error occurred while generating the response'
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message: errorMessage }),
      })
    } finally {
      clearTimeout(streamTimeout)
    }
  })
})

// GET /:deckId/history — Get chat history for a deck
chat.get('/:deckId/history', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('deckId')

  // Check access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.deckId, deckId))
    .orderBy(chatMessages.createdAt)

  return c.json({ messages })
})

// DELETE /:deckId/history — Clear chat history for a deck
chat.delete('/:deckId/history', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('deckId')

  // Check access
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }
  if (access.role === 'viewer') {
    return c.json({ error: 'Forbidden: viewers cannot clear chat' }, 403)
  }

  // Require a confirmation token in request body (deckId) to reduce accidental clears
  let confirm = ''
  try {
    const body = await c.req.json()
    confirm = body?.confirm ?? ''
  } catch {
    // ignore — body may be empty
  }
  if (confirm !== deckId) {
    return c.json({ error: 'Confirmation required' }, 400)
  }

  await db.delete(chatMessages).where(eq(chatMessages.deckId, deckId))
  return c.json({ ok: true })
})

export default chat
