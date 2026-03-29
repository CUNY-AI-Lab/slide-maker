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
import sharing from './routes/sharing.js'
import filesRouter from './routes/files.js'
import search from './routes/search.js'

const app = new Hono()

app.use('/*', cors({
  origin: env.publicUrl,
  credentials: true,
}))

app.use('/*', csrf({ origin: env.publicUrl }))
// 11MB for file upload routes (10MB file + overhead), 2MB for everything else
app.use('/api/decks/:id/files', bodyLimit({ maxSize: 11 * 1024 * 1024 }))
app.use('/*', bodyLimit({ maxSize: 2 * 1024 * 1024 }))

app.get('/', (c) => c.json({ name: 'slide-wiz-dev', status: 'ok' }))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Serve static files (Leaflet, etc.) for artifact iframes
app.get('/api/static/:file', async (c) => {
  const file = c.req.param('file')
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const filePath = path.join(__dirname, '..', 'static', path.basename(file))
  if (!fs.existsSync(filePath)) return c.text('Not found', 404)
  const content = fs.readFileSync(filePath, 'utf-8')
  const ext = path.extname(file)
  const type = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/plain'
  c.header('Content-Type', type)
  c.header('Cache-Control', 'public, max-age=86400')
  c.header('Access-Control-Allow-Origin', '*')
  return c.body(content)
})

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
app.route('/api/search', search)

serve({
  fetch: app.fetch,
  port: env.port,
}, () => {
  console.log(`API server running on http://localhost:${env.port}`)
})

export default app
