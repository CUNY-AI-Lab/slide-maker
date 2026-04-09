import { Hono } from 'hono'
import type { Session, User } from 'lucia'
import { env } from '../env.js'
import { ANTHROPIC_MODELS } from '../providers/anthropic.js'
import { OPENROUTER_MODELS } from '../providers/openrouter.js'
import { BEDROCK_MODELS } from '../providers/bedrock.js'
import { authMiddleware } from '../middleware/auth.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const providers = new Hono<AuthEnv>()

// GET / — List available models (filtered by which API keys are configured)
providers.get('/', authMiddleware, (c) => {
  const user = c.get('user')
  const isAdmin = user?.role === 'admin'

  const list: any[] = []

  if (env.anthropicApiKey) {
    list.push(...ANTHROPIC_MODELS)
  }

  if (env.openrouterApiKey) {
    list.push(...OPENROUTER_MODELS)
  }

  // Expose AWS Bedrock models if region is configured (credentials are resolved via SDK)
  if (env.awsRegion) {
    list.push(...BEDROCK_MODELS)
  }

  // Optional provider filter from env/CLI
  const providerFilter = env.aiProvider

  const models = list
    .filter((m) => (providerFilter ? m.provider === providerFilter : true))
    .filter((m) => (isAdmin ? true : !m.adminOnly))
    .map((m) => ({ id: m.id, name: m.name, provider: m.provider }))

  return c.json({ models })
})

export default providers
