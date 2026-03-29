import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import type { Session, User } from 'lucia'
import { authMiddleware } from '../middleware/auth.js'
import { env } from '../env.js'
import { db } from '../db/index.js'
import { deckAccess } from '../db/schema.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const search = new Hono<AuthEnv>()

search.use('*', authMiddleware)

// POST /api/search — Search the web via Tavily
search.post('/', async (c) => {
  if (!env.tavilyApiKey) {
    return c.json({ error: 'Search not configured' }, 503)
  }

  const { query, searchType } = await c.req.json<{ query: string; searchType?: 'general' | 'images' }>()

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Query required' }, 400)
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.tavilyApiKey,
        query: query.trim(),
        search_depth: 'basic',
        include_images: true,
        include_answer: true,
        max_results: 5,
        exclude_domains: [
          'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
          'redtube.com', 'youporn.com', 'rule34.xxx', 'e621.net',
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Tavily error:', err)
      return c.json({ error: 'Search failed' }, 502)
    }

    const data = await res.json()

    return c.json({
      answer: data.answer ?? null,
      results: (data.results ?? []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content?.slice(0, 200),
      })),
      images: (data.images ?? []).slice(0, 8),
    })
  } catch (err) {
    console.error('Search error:', err)
    return c.json({ error: 'Search failed' }, 500)
  }
})

// POST /api/search/download-image — Download an image from URL and save as uploaded file
search.post('/download-image', async (c) => {
  const { url, deckId, filename } = await c.req.json<{ url: string; deckId: string; filename?: string }>()

  if (!url || !deckId) {
    return c.json({ error: 'url and deckId required' }, 400)
  }

  // Check deck access
  const user = c.get('user')
  const access = await db
    .select()
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, user.id)))
    .get()

  if (!access || access.role === 'viewer') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Validate URL
  if (!/^https?:\/\//i.test(url)) {
    return c.json({ error: 'Invalid URL' }, 400)
  }

  // Block inappropriate domains
  const blockedDomains = ['pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube', 'youporn', 'rule34', 'e621']
  const urlLower = url.toLowerCase()
  if (blockedDomains.some(d => urlLower.includes(d))) {
    return c.json({ error: 'This source is not allowed' }, 403)
  }

  try {
    // Fetch the image
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'CUNY-AI-Lab-SlideMaker/1.0' },
    })

    if (!imgRes.ok) {
      return c.json({ error: `Failed to fetch image: ${imgRes.status}` }, 502)
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return c.json({ error: 'URL does not point to an image' }, 400)
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer())

    if (buffer.length > 10 * 1024 * 1024) {
      return c.json({ error: 'Image too large (max 10MB)' }, 400)
    }

    // Save to uploads
    const { createId } = await import('@paralleldrive/cuid2')
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const { db } = await import('../db/index.js')
    const { uploadedFiles } = await import('../db/schema.js')

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

    const fileId = createId()
    const ext = contentType.includes('png') ? '.png' : contentType.includes('gif') ? '.gif' : contentType.includes('webp') ? '.webp' : '.jpg'
    const diskFilename = `${fileId}${ext}`
    const deckDir = path.join(UPLOADS_DIR, deckId)

    fs.mkdirSync(deckDir, { recursive: true })
    fs.writeFileSync(path.join(deckDir, diskFilename), buffer)

    const user = c.get('user')
    const savedFilename = filename ?? `web-image${ext}`

    await db.insert(uploadedFiles).values({
      id: fileId,
      deckId,
      filename: savedFilename,
      mimeType: contentType,
      path: `${deckId}/${diskFilename}`,
      uploadedBy: user.id,
      createdAt: new Date(),
    })

    return c.json({
      file: {
        id: fileId,
        filename: savedFilename,
        mimeType: contentType,
        url: `/api/decks/${deckId}/files/${fileId}`,
      },
    })
  } catch (err) {
    console.error('Image download error:', err)
    return c.json({ error: 'Failed to download image' }, 500)
  }
})

export default search
