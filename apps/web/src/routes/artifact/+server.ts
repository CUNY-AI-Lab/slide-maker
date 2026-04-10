import type { RequestHandler } from '@sveltejs/kit'

// Serves inline artifact HTML via a same-origin URL so subresources
// (e.g., map tiles) receive a proper Referer header.
// Requires a valid session cookie to prevent unauthenticated XSS.
export const GET: RequestHandler = async ({ url, cookies }) => {
  // Require auth — reject if no session cookie present
  const session = cookies.get('auth_session')
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const b64 = url.searchParams.get('b64')
  if (!b64) return new Response('Missing b64 parameter', { status: 400 })
  try {
    const html = Buffer.from(b64, 'base64').toString('utf8')
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' blob: data:; script-src 'unsafe-inline'; img-src https: data: blob:; style-src 'unsafe-inline'; connect-src 'none'; frame-src 'none';",
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new Response('Invalid artifact payload', { status: 400 })
  }
}
