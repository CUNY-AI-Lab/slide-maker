import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import type { Session, User } from 'lucia'
import { authMiddleware } from '../middleware/auth.js'
import { searchRateLimit } from '../middleware/rate-limit.js'
import { env } from '../env.js'
import { db } from '../db/index.js'
import { deckAccess } from '../db/schema.js'
import { validateUrlForSsrf } from '../utils/ssrf-guard.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const search = new Hono<AuthEnv>()

search.use('*', authMiddleware)
search.use('*', searchRateLimit)

/** Strip HTML tags from external API response strings (Brave returns <strong> highlights, etc.) */
function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

const BLOCKED_SEARCH_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
  'redtube.com', 'youporn.com', 'rule34.xxx', 'e621.net',
]

type SearchResult = {
  answer: string | null
  results: { title: string; url: string; content: string }[]
  images: string[]
}

async function searchViaTavily(query: string): Promise<SearchResult> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.tavilyApiKey,
      query,
      search_depth: 'basic',
      include_images: true,
      include_answer: true,
      max_results: 5,
      exclude_domains: BLOCKED_SEARCH_DOMAINS,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tavily ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    answer: data.answer ?? null,
    results: (data.results ?? []).map((r: any) => ({
      title: stripHtmlTags(r.title ?? ''),
      url: r.url ?? '',
      content: stripHtmlTags((r.content ?? '').slice(0, 200)),
    })),
    images: (data.images ?? []).slice(0, 8),
  }
}

async function searchViaBrave(query: string): Promise<SearchResult> {
  // Fetch web results and image results in parallel
  const [webRes, imgRes] = await Promise.all([
    fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({
      q: query,
      count: '5',
      safesearch: 'moderate',
    })}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': env.braveApiKey,
      },
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`https://api.search.brave.com/res/v1/images/search?${new URLSearchParams({
      q: query,
      count: '8',
      safesearch: 'moderate',
    })}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': env.braveApiKey,
      },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null), // image search failure shouldn't block web results
  ])

  if (!webRes.ok) {
    const err = await webRes.text()
    throw new Error(`Brave ${webRes.status}: ${err}`)
  }

  const webData = await webRes.json()
  const webResults = (webData.web?.results ?? [])
    .filter((r: any) => !BLOCKED_SEARCH_DOMAINS.some(d => r.url?.toLowerCase().includes(d)))
    .map((r: any) => ({
      title: stripHtmlTags(r.title ?? ''),
      url: r.url ?? '',
      content: stripHtmlTags((r.description ?? '').slice(0, 200)),
    }))

  let images: string[] = []
  if (imgRes?.ok) {
    const imgData = await imgRes.json()
    images = (imgData.results ?? [])
      .filter((r: any) => r.properties?.url && !BLOCKED_SEARCH_DOMAINS.some(d => r.properties.url.toLowerCase().includes(d)))
      .map((r: any) => r.properties.url)
      .slice(0, 8)
  }

  return {
    answer: null, // Brave doesn't provide summarized answers
    results: webResults,
    images,
  }
}

// POST /api/search — Search the web via Tavily or Brave
search.post('/', async (c) => {
  if (!env.tavilyApiKey && !env.braveApiKey) {
    return c.json({ error: 'Search not configured' }, 503)
  }

  const { query } = await c.req.json<{ query: string }>()

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Query required' }, 400)
  }

  if (query.trim().length > 400) {
    return c.json({ error: 'Query too long (max 400 chars)' }, 400)
  }

  try {
    const result = env.tavilyApiKey
      ? await searchViaTavily(query.trim())
      : await searchViaBrave(query.trim())

    return c.json(result)
  } catch (err) {
    console.error('Search error:', err)
    return c.json({ error: 'Search failed' }, 500)
  }
})

// POST /api/search/images — Search Pexels for openly licensed images
search.post('/images', async (c) => {
  if (!env.pexelsApiKey) {
    return c.json({ error: 'Image search not configured (PEXELS_API_KEY missing)' }, 503)
  }

  const { query, perPage } = await c.req.json<{ query: string; perPage?: number }>()
  if (!query?.trim() || query.trim().length > 200) {
    return c.json({ error: 'Query required (max 200 chars)' }, 400)
  }

  const clampedPerPage = Math.min(Math.max(Number(perPage) || 5, 1), 10)

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query.trim())}&per_page=${clampedPerPage}&orientation=landscape`,
      {
        headers: { Authorization: env.pexelsApiKey },
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      console.error('Pexels API error:', res.status, await res.text())
      return c.json({ error: 'Image search failed' }, 502)
    }

    const data = await res.json()
    return c.json({
      images: (data.photos ?? []).map((p: any) => ({
        id: p.id,
        url: p.src?.large ?? p.src?.original,
        thumbnail: p.src?.medium,
        alt: p.alt || query,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        pexelsUrl: p.url,
      })),
    })
  } catch (err) {
    console.error('Pexels search error:', err)
    return c.json({ error: 'Image search failed' }, 500)
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
  const urlLower = url.toLowerCase()
  if (BLOCKED_SEARCH_DOMAINS.some(d => urlLower.includes(d))) {
    return c.json({ error: 'This source is not allowed' }, 403)
  }

  // SSRF protection: validate URL resolves to a public IP
  try {
    await validateUrlForSsrf(url)
  } catch {
    return c.json({ error: 'URL is not allowed' }, 400)
  }

  try {
    // Fetch the image with timeout and no redirect following
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'CUNY-AI-Lab-SlideMaker/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })

    // Reject redirects (could bypass SSRF validation)
    if (imgRes.status >= 300 && imgRes.status < 400) {
      return c.json({ error: 'Redirects are not followed for security' }, 400)
    }

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
