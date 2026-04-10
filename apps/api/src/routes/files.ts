import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import type { Session, User } from 'lucia'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '../db/index.js'
import { uploadedFiles, deckAccess } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_TOTAL_UPLOADS = 50 * 1024 * 1024 // 50MB total per deck

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'application/json',
  'application/geo+json',
])

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/geo+json': '.geojson',
}

function guessMimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.geojson')) return 'application/geo+json'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  return null
}

const filesRouter = new Hono<AuthEnv>()

// POST /:deckId/files — Upload a file
filesRouter.post('/:deckId/files', authMiddleware, async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('deckId')!

  // Check deck access (not viewer)
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large (max 10MB per file)' }, 400)
  }

  // Check total uploads for this deck
  const deckDir = path.join(UPLOADS_DIR, deckId)
  let currentTotal = 0
  if (fs.existsSync(deckDir)) {
    const files = fs.readdirSync(deckDir)
    for (const f of files) {
      const stat = fs.statSync(path.join(deckDir, f))
      currentTotal += stat.size
    }
  }
  if (currentTotal + file.size > MAX_TOTAL_UPLOADS) {
    const usedMB = Math.round(currentTotal / 1024 / 1024)
    return c.json({ error: `Upload limit reached (${usedMB}MB / 50MB used). Delete some files first.` }, 400)
  }

  // Derive a sensible MIME type
  const detectedType = file.type || guessMimeFromFilename(file.name) || 'application/octet-stream'
  const allowedByExt = ['.md', '.markdown', '.txt'].some((ext) => file.name.toLowerCase().endsWith(ext))
  if (!ALLOWED_TYPES.has(detectedType) && !allowedByExt) {
    return c.json({ error: `File type not allowed: ${file.type || 'unknown'}` }, 400)
  }

  const fileId = createId()
  const ext = MIME_TO_EXT[detectedType] ?? path.extname(file.name) ?? ''
  const diskFilename = `${fileId}${ext}`
  const filePath = path.join(deckDir, diskFilename)

  // Ensure directory exists
  fs.mkdirSync(deckDir, { recursive: true })

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  // For PDFs and Word docs, extract Markdown sidecar for LLM context
  let extractedMarkdown: string | null = null
  try {
    if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type === 'application/msword') {
      const { extractMarkdownFromFile } = await import('../utils/file-text.js')
      extractedMarkdown = await extractMarkdownFromFile(filePath, file.type)
      if (extractedMarkdown && extractedMarkdown.trim()) {
        const mdPath = path.join(deckDir, `${fileId}.md`)
        fs.writeFileSync(mdPath, extractedMarkdown, 'utf8')
      }
    }
  } catch (err) {
    console.warn('Failed to extract text from upload:', (err as Error)?.message)
  }

  // Record in DB
  await db.insert(uploadedFiles).values({
    id: fileId,
    deckId,
    filename: file.name,
    mimeType: detectedType,
    path: filePath,
    uploadedBy: user.id,
    createdAt: new Date(),
  })

  return c.json({
    file: {
      id: fileId,
      filename: file.name,
      mimeType: detectedType,
      url: `/api/decks/${deckId}/files/${fileId}`,
      textExtracted: Boolean(extractedMarkdown && extractedMarkdown.trim()),
    },
  })
})

// GET /:deckId/files — List files for a deck
filesRouter.get('/:deckId/files', authMiddleware, async (c) => {
  const deckId = c.req.param('deckId')!

  const user = c.get('user')
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access) {
    return c.json({ error: 'Not found or no access' }, 404)
  }

  const files = await db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.deckId, deckId))

  return c.json({
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      url: `/api/decks/${deckId}/files/${f.id}`,
      createdAt: f.createdAt,
    })),
  })
})

// GET /:deckId/files/:fileId — Serve a file (no auth — files served by CUID)
filesRouter.get('/:deckId/files/:fileId', async (c) => {
  const deckId = c.req.param('deckId')!
  const fileId = c.req.param('fileId')!

  const file = await db
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.deckId, deckId)))
    .get()

  if (!file) {
    return c.json({ error: 'File not found' }, 404)
  }

  // Resolve path — may be absolute or relative to UPLOADS_DIR
  const resolvedPath = path.isAbsolute(file.path) ? file.path : path.join(UPLOADS_DIR, file.path)

  if (!fs.existsSync(resolvedPath)) {
    return c.json({ error: 'File not found on disk' }, 404)
  }

  const data = fs.readFileSync(resolvedPath)
  c.header('Content-Type', file.mimeType)
  // Force download for SVG to prevent script execution
  if (file.mimeType === 'image/svg+xml') {
    const safeName = path.basename(file.filename).replace(/[^\w.\-]/g, '_')
    c.header('Content-Disposition', `attachment; filename="${safeName}"`)
  }
  c.header('Cache-Control', 'private, max-age=86400')
  return c.body(data)
})

// DELETE /:deckId/files/:fileId — Delete a file
filesRouter.delete('/:deckId/files/:fileId', authMiddleware, async (c) => {
  const user = c.get('user')
  const deckId = c.req.param('deckId')!
  const fileId = c.req.param('fileId')!

  // Check deck access (not viewer)
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const file = await db
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.deckId, deckId)))
    .get()

  if (!file) {
    return c.json({ error: 'File not found' }, 404)
  }

  // Delete from disk
  const deletePath = path.isAbsolute(file.path) ? file.path : path.join(UPLOADS_DIR, file.path)
  if (fs.existsSync(deletePath)) {
    fs.unlinkSync(deletePath)
  }

  // Delete from DB
  await db
    .delete(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))

  return c.json({ success: true })
})

export default filesRouter
