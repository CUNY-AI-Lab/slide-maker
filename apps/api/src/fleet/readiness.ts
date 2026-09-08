import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'

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
      if (!process.env.CAIL_GATEWAY_URL) throw new Error('gateway')
      await checkIdentity()
      checkStorage()
    } catch {
      return c.json({ status: 'not_ready' }, 503)
    }
    return c.json({ status: 'ready', release, service: 'slide-maker' })
  })
  return router
}
