import { Hono } from 'hono'

const artifactRouter = new Hono()

// Serves base64-encoded inline artifact HTML for previews.
artifactRouter.get('/artifact', async (c) => {
  const b64 = c.req.query('b64')
  if (!b64) return c.text('Missing b64 parameter', 400)
  try {
    const html = Buffer.from(b64, 'base64').toString('utf8')
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' blob: data:; script-src 'unsafe-inline'; img-src https: data: blob:; style-src 'unsafe-inline'; connect-src 'none'; frame-src 'none';",
      },
    })
  } catch {
    return c.text('Invalid artifact payload', 400)
  }
})

export default artifactRouter

