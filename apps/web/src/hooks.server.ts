import type { Handle } from '@sveltejs/kit'

const isDev = process.env.NODE_ENV !== 'production'
const localhost = isDev ? ' http://localhost:*' : ''

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)

  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.qzz.io https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: blob: https://*.qzz.io https://*.cuny.edu https://images.pexels.com https://*.pexels.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com${localhost}`,
      `connect-src 'self'${localhost} https://*.cuny.edu https://*.qzz.io https://*.cloudflareinsights.com`,
      "frame-src 'self' blob: https://www.youtube.com https://player.vimeo.com https://www.loom.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  )

  return response
}
