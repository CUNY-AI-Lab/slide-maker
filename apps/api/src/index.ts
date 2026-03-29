import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
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

const app = new Hono()

app.use('/*', cors({
  origin: env.publicUrl,
  credentials: true,
}))

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

serve({
  fetch: app.fetch,
  port: env.port,
}, () => {
  console.log(`API server running on http://localhost:${env.port}`)
})

export default app
