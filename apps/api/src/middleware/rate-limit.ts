import type { Context, Next } from 'hono'
import { RateLimiterMemory } from 'rate-limiter-flexible'

// Login: 5 attempts per 15 minutes per IP
const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60,
  keyPrefix: 'login',
})

// Registration: 3 attempts per hour per IP
const registerLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60,
  keyPrefix: 'register',
})

// Chat: 30 requests per minute per IP
const chatLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
  keyPrefix: 'chat',
})

function getClientIp(c: Context): string {
  // Only trust proxy headers when request comes from localhost (Nginx)
  const raw = c.req.raw
  const connectingIp = (raw as any).socket?.remoteAddress ?? 'unknown'
  const isFromProxy = connectingIp === '127.0.0.1' || connectingIp === '::1' || connectingIp === '::ffff:127.0.0.1'

  if (isFromProxy) {
    return (
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      connectingIp
    )
  }

  return connectingIp
}

function createRateLimitMiddleware(limiter: RateLimiterMemory) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c)
    try {
      await limiter.consume(ip)
      return next()
    } catch {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }
  }
}

export const loginRateLimit = createRateLimitMiddleware(loginLimiter)
export const registerRateLimit = createRateLimitMiddleware(registerLimiter)
export const chatRateLimit = createRateLimitMiddleware(chatLimiter)
