import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'

function validGatewayOrigin(value: string | undefined) {
  try {
    const url = new URL(value ?? '')
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'
      && (url.origin === 'https://tools.ailab.gc.cuny.edu' || (process.env.NODE_ENV === 'test'
        && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
  } catch { return false }
}

export function readinessRouter(checkStorage: () => void, checkIdentity: () => unknown | Promise<unknown>) {
  const router = new Hono()
  router.get('/ready', async (c) => {
    const configured = process.env.READINESS_TOKEN
    const authorization = c.req.header('authorization')
    const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
    if (!configured || !supplied || Buffer.byteLength(configured) !== Buffer.byteLength(supplied)
      || !timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))) {
      return c.json({ error: 'Not found' }, 404)
    }
    const release = process.env.RELEASE_SHA
    try {
      if (!release || !/^[a-f0-9]{40}$/.test(release)) throw new Error('release')
      if (!validGatewayOrigin(process.env.CAIL_GATEWAY_URL)) throw new Error('gateway')
      await checkIdentity()
      checkStorage()
    } catch {
      return c.json({ status: 'not_ready' }, 503)
    }
    return c.json({ status: 'ready', release, service: 'slide-maker' })
  })
  return router
}
