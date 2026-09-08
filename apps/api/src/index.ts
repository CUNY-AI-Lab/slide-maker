import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './env.js'

const displayHost = env.host.includes(':') ? `[${env.host}]` : env.host
serve({ fetch: app.fetch, hostname: env.host, port: env.port }, () => {
  console.log(`API server running on http://${displayHost}:${env.port}`)
})
export default app
