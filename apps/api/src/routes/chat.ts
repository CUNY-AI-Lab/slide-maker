import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, and, inArray, gte, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { decks, deckAccess, slides, contentBlocks, chatMessages, templates, themes, uploadedFiles, users, tokenUsage, artifacts } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { chatRateLimit } from '../middleware/rate-limit.js'
import { getModelStream, ALL_MODELS } from '../providers/index.js'
import { buildSystemPrompt } from '../prompts/system.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { debugBus } from '../debug/event-bus.js'
import { appendTranscript } from '../debug/transcript-log.js'

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
  const { message, deckId, activeSlideId, modelId, recentActions, lastAgentSlideId, renderDiagnostics } = body

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
      sourceNodeIds: Array.isArray(b.sourceNodeIds) ? (b.sourceNodeIds as string[]) : null,
    })),
  }))

  // Resolve fidelity + outline markdown from deck metadata
  const deckMetadata = (deck.metadata ?? {}) as Record<string, unknown>
  const deckFidelity = typeof deckMetadata.fidelity === 'string'
    && ['strict', 'balanced', 'interpretive'].includes(deckMetadata.fidelity as string)
    ? (deckMetadata.fidelity as 'strict' | 'balanced' | 'interpretive')
    : null
  const outlineFileIdMeta = typeof deckMetadata.outlineFileId === 'string'
    ? deckMetadata.outlineFileId
    : null

  let outlineMarkdown = ''
  if (deckFidelity === 'strict' && outlineFileIdMeta) {
    try {
      const outlineFile = await db
        .select()
        .from(uploadedFiles)
        .where(and(eq(uploadedFiles.id, outlineFileIdMeta), eq(uploadedFiles.deckId, deckId)))
        .get()
      if (outlineFile) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url))
        const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')
        const filePath = path.isAbsolute(outlineFile.path)
          ? outlineFile.path
          : path.join(UPLOADS_DIR, outlineFile.path)
        const mt = (outlineFile.mimeType || '').toLowerCase()
        if (mt.includes('markdown') || mt === 'text/plain') {
          outlineMarkdown = fs.readFileSync(filePath, 'utf8').trim()
        } else {
          const mdPath = path.join(path.dirname(filePath), `${outlineFile.id}.md`)
          if (fs.existsSync(mdPath)) {
            outlineMarkdown = fs.readFileSync(mdPath, 'utf8').trim()
          }
        }
      }
    } catch {
      // Outline unavailable — fidelity contract still applies via [strict-locked] markers
    }
  }

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
    const candidates = list.filter((f) => {
      const mt = (f.mimeType || '').toLowerCase()
      return mt.includes('pdf') || mt.includes('word') || mt.includes('markdown') || mt === 'text/plain'
    })
    let perDoc = candidates.length > 0 ? Math.floor(MAX_TOTAL / candidates.length) : 0
    if (perDoc < 1200) perDoc = 1200

    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

      for (const f of list) {
        const mt = (f.mimeType || '').toLowerCase()
        if (!(mt.includes('pdf') || mt.includes('word') || mt.includes('markdown') || mt === 'text/plain')) continue
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

  const allThemesList = await db.select({ id: themes.id, name: themes.name }).from(themes)

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
  const artifactNamesById = new Map(allArtifacts.map((artifact) => [artifact.id, artifact.name]))

  // Compute active artifacts (those placed in deck slides)
  const activeArtifactsMap = new Map<string, { name: string; slidePositions: number[]; config: Record<string, unknown> }>()
  for (const slide of slidesWithBlocks) {
    for (const block of slide.blocks) {
      if (block.type !== 'artifact') continue
      const d = block.data as Record<string, unknown>
      const registryId = typeof d.registryId === 'string' ? d.registryId : ''
      const name = String(d.artifactName || artifactNamesById.get(registryId) || (registryId && !registryId.startsWith('artifact-') ? artifactNamesById.get(`artifact-${registryId}`) : '') || d.alt || '').trim()
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
  // Detect @template: references for focused template detail in system prompt
  const templateAtRefs = [...message.matchAll(/@template:([^\n@]+)/gi)].map((m) => m[1].trim())

  // Detect slide references in user message for on-demand expansion
  const slideRefs = [...message.matchAll(/(?:slide|page)\s*(\d+)/gi)]
    .map((m) => {
      const idx = parseInt(m[1], 10) - 1
      return idx >= 0 && idx < slidesWithBlocks.length ? slidesWithBlocks[idx].id : null
    })
    .filter((id): id is string => id !== null)

  // Build system prompt
  type NormalizedRenderDiagnostic = {
    moduleId: string
    slideId: string
    moduleType: string
    surface: 'edit' | 'preview'
    status: 'idle' | 'loading' | 'ready' | 'error'
    message?: string
  }

  const normalizedRenderDiagnostics: NormalizedRenderDiagnostic[] | undefined = Array.isArray(renderDiagnostics)
    ? renderDiagnostics
      .filter((diagnostic: unknown) => diagnostic && typeof diagnostic === 'object')
      .map((diagnostic: any): NormalizedRenderDiagnostic => ({
        moduleId: String(diagnostic.moduleId || ''),
        slideId: String(diagnostic.slideId || ''),
        moduleType: String(diagnostic.moduleType || 'artifact'),
        surface: diagnostic.surface === 'preview' ? 'preview' : 'edit',
        status:
          diagnostic.status === 'error'
            ? 'error'
            : diagnostic.status === 'ready'
              ? 'ready'
              : diagnostic.status === 'loading'
                ? 'loading'
                : 'idle',
        message: typeof diagnostic.message === 'string' ? diagnostic.message : undefined,
      }))
      .filter((diagnostic): diagnostic is NormalizedRenderDiagnostic => Boolean(diagnostic.moduleId && diagnostic.slideId))
    : undefined

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
    focusedTemplateNames: templateAtRefs.length > 0 ? templateAtRefs : undefined,
    allThemes: allThemesList,
    expandSlideIds: slideRefs.length > 0 ? slideRefs : undefined,
    recentActions: Array.isArray(recentActions)
      ? recentActions.slice(0, 15).map((a: unknown) => String(a).slice(0, 120).replace(/[\n\r]/g, ' '))
      : undefined,
    renderDiagnostics: normalizedRenderDiagnostics,
    lastAgentSlideId: typeof lastAgentSlideId === 'string' && slidesWithBlocks.some((s) => s.id === lastAgentSlideId)
      ? lastAgentSlideId
      : undefined,
    fidelity: deckFidelity,
    outlineMarkdown: outlineMarkdown || undefined,
  })

  // Prepare messages for the LLM
  // Reconstruct chat history server-side from DB (never trust client-supplied history)
  const dbMessages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.deckId, deckId))
    .orderBy(chatMessages.createdAt)

  let chatHistory: { role: 'user' | 'assistant'; content: string }[] = dbMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Limit history to prevent context window overflow
  const MAX_HISTORY = 30
  if (chatHistory.length > MAX_HISTORY) {
    chatHistory = chatHistory.slice(-MAX_HISTORY)
  }

  chatHistory.push({ role: 'user', content: message })

  // Determine provider from registered models (supports openrouter, anthropic, bedrock)
  const provider = (ALL_MODELS.find((m) => m.id === modelId)?.provider || 'unknown') as string

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
    provider,
    createdAt: now,
  })

  // Stream response
  return streamSSE(c, async (stream) => {
    let fullResponse = ''
    const streamTimeout = setTimeout(() => { stream.close() }, 120_000) // 2 min hard cap
    const streamId = createId()
    const startedAt = Date.now()
    let chunkIndex = 0
    let totalChars = 0

    try {
      const gen = getModelStream(modelId, systemPrompt, chatHistory)

      // Emit start event
      debugBus.emit('stream:start', {
        streamId,
        userId: user.id,
        userEmail: user.email,
        deckId,
        model: modelId,
        provider,
        systemPromptChars: systemPrompt.length,
        historyLength: chatHistory.length,
        timestamp: new Date(startedAt).toISOString(),
      })

      for await (const text of gen) {
        fullResponse += text
        totalChars += text.length
        await stream.writeSSE({
          data: JSON.stringify({ type: 'text', content: text }),
        })
        // Emit chunk event
        debugBus.emit('stream:chunk', {
          streamId,
          text,
          chunkIndex: chunkIndex++,
          elapsedMs: Date.now() - startedAt,
        })
      }

      await stream.writeSSE({
        data: JSON.stringify({ type: 'done' }),
      })

      // Extract mutation blocks from assistant response (before persisting)
      const mutations = (() => {
        const blocks: string[] = []
        const re = /```\s*mutation\s*\n([\s\S]*?)```/gi
        let m: RegExpExecArray | null
        while ((m = re.exec(fullResponse)) !== null) {
          blocks.push(m[1].trim())
        }
        return blocks
      })()

      // Save assistant message to DB (persist extracted mutations)
      const assistantMsgId = createId()
      await db.insert(chatMessages).values({
        id: assistantMsgId,
        deckId,
        role: 'assistant',
        content: fullResponse,
        mutations: mutations as unknown as any,
        provider,
        createdAt: new Date(),
      })

      // Estimate and record token usage
      const allInputLength = systemPrompt.length + chatHistory.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
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

      // Emit done event
      debugBus.emit('stream:done', {
        streamId,
        totalChars,
        durationMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        mutations,
      })

      // Append transcript log
      await appendTranscript({
        id: streamId,
        timestamp: new Date().toISOString(),
        userEmail: user.email,
        deckId,
        model: modelId,
        provider,
        systemPromptChars: systemPrompt.length,
        historyLength: chatHistory.length,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
        userMessage: message,
        assistantMessage: fullResponse,
        mutations,
        error: null,
      })
    } catch (err: unknown) {
      console.error('AI streaming error:', err)
      const errorMessage = 'An error occurred while generating the response'
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message: errorMessage }),
      })
      // Emit error event
      debugBus.emit('stream:error', {
        streamId,
        error: (err as any)?.message ?? String(err),
        elapsedMs: Date.now() - startedAt,
      })
      // Append transcript with error
      try {
        await appendTranscript({
          id: streamId,
          timestamp: new Date().toISOString(),
          userEmail: user.email,
          deckId,
          model: modelId,
          provider,
          systemPromptChars: systemPrompt.length,
          historyLength: chatHistory.length,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: Date.now() - startedAt,
          userMessage: message,
          assistantMessage: fullResponse,
          mutations: [],
          error: (err as any)?.message ?? String(err),
        })
      } catch {}
    } finally {
      clearTimeout(streamTimeout)
    }
  })
})

// POST /:deckId/messages — Save chat messages (for search results, system messages, etc.)
chat.post('/:deckId/messages', async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('deckId')

  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }
  if (access.role === 'viewer') {
    return c.json({ error: 'Forbidden: viewers cannot save messages' }, 403)
  }

  // Parse body with guard
  let messages: { role: 'user' | 'assistant'; content: string }[] | undefined
  try {
    const body = await c.req.json<{ messages: { role: 'user' | 'assistant'; content: string }[] }>()
    messages = body?.messages
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 10) {
    return c.json({ error: 'messages required (max 10)' }, 400)
  }

  // Runtime validation of message roles + content
  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      return c.json({ error: 'Invalid role' }, 400)
    }
    if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
      return c.json({ error: 'Invalid content' }, 400)
    }
  }

  const now = new Date()
  for (const msg of messages) {
    const content = (msg.content || '').slice(0, 10000)
    await db.insert(chatMessages).values({
      id: createId(),
      deckId,
      role: msg.role,
      content,
      provider: 'system',
      createdAt: now,
    })
  }

  return c.json({ ok: true })
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
