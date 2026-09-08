import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { User, Session } from 'lucia'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { loadIdentityConfigs, verifyRequestIdentity } from '../auth/identity.js'
import { lucia } from '../auth/lucia.js'

export type AuthEnv = { Variables: { user: User; session: Session | null; gatewayToken: string | undefined; canonicalSubject: string | undefined } }

export async function authMiddleware(c: Context, next: Next) {
  if (process.env.NODE_ENV === 'production' || c.req.header('x-cail-identity-jwt') !== undefined || c.req.header('x-cail-gateway-identity-jwt') !== undefined) {
    let configs
    try { configs = await loadIdentityConfigs() } catch { return c.json({ error: 'Identity unavailable' }, 503) }
    const identity = await verifyRequestIdentity(c.req.raw.headers, configs)
    if (!identity) return c.json({ error: 'Unauthorized' }, 401)
    const user = db.select().from(users).where(eq(users.canonicalSubject, identity.subject)).get()
    if (!user || user.status !== 'approved') return c.json({ error: 'Account requires operator verification' }, 403)
    c.set('user', { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, emailVerified: user.emailVerified })
    c.set('session', null)
    c.set('canonicalSubject', identity.subject)
    c.set('gatewayToken', identity.gatewayToken)
    return next()
  }
  const sessionId = getCookie(c, lucia.sessionCookieName)
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { session, user } = await lucia.validateSession(sessionId)
  if (!session) {
    const blankCookie = lucia.createBlankSessionCookie()
    c.header('Set-Cookie', blankCookie.serialize())
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id)
    c.header('Set-Cookie', sessionCookie.serialize())
  }

  c.set('user', user)
  c.set('session', session)
  return next()
}
