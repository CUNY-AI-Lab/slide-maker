import { Hono } from 'hono'
import { gateway, safeGatewayError, gatewayErrorStatus } from '../providers/index.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'

const providers = new Hono<AuthEnv>()
providers.use('*', authMiddleware)
providers.get('/', async (c) => {
  try {
    const catalog = await gateway.getCatalogSnapshot({ modality: 'text', signal: c.req.raw.signal })
    return c.json({ models: catalog.data.filter(model => model.streaming).map(model => ({
      id: model.id, name: model.name ?? model.id, provider: 'cail-gateway',
    })) })
  } catch (error) {
    return c.json(safeGatewayError(error), gatewayErrorStatus(error))
  }
})
providers.get('/quota', async (c) => {
  const token = c.get('gatewayToken')
  if (!token) return c.json({ error: 'Institutional sign-in required' }, 401)
  try {
    return c.json(await gateway.getQuota({ kind: 'jwt', token }, { signal: c.req.raw.signal }))
  } catch (error) {
    return c.json(safeGatewayError(error), gatewayErrorStatus(error))
  }
})
export default providers
