import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { csrf } from 'hono/csrf'
import { env } from './env.js'
import auth from './routes/auth.js'
import admin from './routes/admin.js'
import { decksRouter } from './routes/decks.js'
import exportRouter from './routes/export.js'
import previewRouter from './routes/preview.js'
import chat from './routes/chat.js'
import providers from './routes/providers.js'
import resources from './routes/resources.js'
import artifactRouter from './routes/artifact.js'
import sharing from './routes/sharing.js'
import filesRouter from './routes/files.js'
import search from './routes/search.js'

const app = new Hono()

app.use('/*', cors({
  origin: env.publicUrl,
  credentials: true,
}))

app.use('/*', csrf({ origin: env.publicUrl }))
// 11MB for file upload routes (10MB file + overhead)
app.use('/api/decks/:id/files', bodyLimit({ maxSize: 11 * 1024 * 1024 }))
// Apply a 2MB limit to all other routes, but explicitly skip the upload endpoint
const smallBodyLimit = bodyLimit({ maxSize: 2 * 1024 * 1024 })
app.use('*', async (c, next) => {
  const { pathname } = new URL(c.req.url)
  // Skip when path matches /api/decks/:deckId/files exactly
  if (/^\/api\/decks\/[^/]+\/files$/.test(pathname)) {
    return next()
  }
  return smallBodyLimit(c, next)
})

app.get('/', (c) => c.json({ name: 'slide-wiz-dev', status: 'ok' }))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', auth)
app.route('/api/admin', admin)
app.route('/api/decks', filesRouter)
app.route('/api/decks', decksRouter)
app.route('/api/decks', exportRouter)
app.route('/api/decks', previewRouter)
app.route('/api/decks', sharing)
app.route('/api/chat', chat)
app.route('/api/providers', providers)
app.route('/api', resources)
app.route('/api', artifactRouter)
app.route('/api/search', search)

serve({
  fetch: app.fetch,
  port: env.port,
}, () => {
  console.log(`API server running on http://localhost:${env.port}`)
})

export default app
