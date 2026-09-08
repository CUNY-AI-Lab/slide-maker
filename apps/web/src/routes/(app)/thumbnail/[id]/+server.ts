import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

const API_URL = env.PUBLIC_API_URL ?? 'http://localhost:3001';

export const GET: RequestHandler = async ({ params, request }) => {
  const res = await fetch(`${API_URL}/api/decks/${params.id}/thumbnail`, {
    headers: {
      cookie: request.headers.get('cookie') || '',
      ...(request.headers.has('x-cail-identity-jwt')
        ? { 'x-cail-identity-jwt': request.headers.get('x-cail-identity-jwt')! } : {}),
    },
    signal: request.signal,
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'text/html',
      'Cache-Control': res.headers.get('Cache-Control') || 'private, max-age=60',
      // Preserve strict CSP from API (blocks scripts in thumbnail iframes)
      'Content-Security-Policy':
        res.headers.get('Content-Security-Policy') ||
        "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; font-src 'none'; img-src 'self' data: blob: https: http://localhost:*; frame-ancestors 'self';",
      // Forward common security headers when present
      ...(res.headers.get('X-Frame-Options') ? { 'X-Frame-Options': res.headers.get('X-Frame-Options')! } : {}),
      ...(res.headers.get('X-Content-Type-Options') ? { 'X-Content-Type-Options': res.headers.get('X-Content-Type-Options')! } : {}),
    },
  });
};
