// Local test edge and Gateway substitutes; the Svelte UI, Hono routes, signed
// identity verification and SQLite persistence are the real application.
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createServer, request as httpRequest } from 'node:http'

const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url))
const requireWeb = createRequire(new URL('../apps/web/package.json', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'slide-browser-'))
const { createTestIdentityIssuer, TEST_SUBJECTS } = await import(requireApi.resolve('@cuny-ai-lab/cail-identity/testing'))
const { quotaSnapshotResponse } = await import(requireApi.resolve('@cuny-ai-lab/cail-client/testing'))
const { serve } = await import(requireApi.resolve('@hono/node-server'))
const issuer = await createTestIdentityIssuer()
const appToken = await issuer.mintIdentityJwt({ audience: 'cail:slide-maker' })
const gatewayToken = await issuer.mintIdentityJwt({ audience: 'cail:gateway' })
let attempts = 0
let cancelled = false
const gatewayServer = serve({ hostname: '127.0.0.1', port: 0, fetch: async request => {
  const path = new URL(request.url).pathname
  if (path === '/v1/catalog') return Response.json({ object: 'list', data: [{ id: 'fixture-model', name: 'Fixture model', object: 'model', recommended: true, tier: 'recommended', order: 0, status: 'active', modality: 'text', provider: 'workers-ai', upstream_model: 'fixture-model', pricing_known: 'catalog', streaming: true, sunset: null, capabilities: [], context_length: 128000, registry_url: null }] })
  if (request.headers.get('x-cail-identity-jwt') !== gatewayToken) return new Response('Unauthorized', { status: 401 })
  if (path === '/v1/quota') return quotaSnapshotResponse({ remaining_percent: 0, used_percent: 100, estimated_remaining: 0, estimated_used: 10000000 })
  if (path === '/v1/chat/completions') {
    attempts++
    if (attempts === 2) {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Streaming fixture"}}]}\n\n'))
          request.signal.addEventListener('abort', () => { cancelled = true; controller.close() }, { once: true })
        },
        cancel() { cancelled = true },
      }), { headers: { 'content-type': 'text/event-stream' } })
    }
    return Response.json({ error: { code: 'quota_exceeded', type: 'rate_limit_error', message: 'PRIVATE_PROVIDER_DETAIL', param: null } }, { status: 429, headers: { 'x-request-id': request.headers.get('x-request-id') ?? '12345678-1234-4123-8123-123456789abc', 'x-should-retry': 'false' } })
  }
  return new Response('Not found', { status: 404 })
} })
await new Promise<void>(done => gatewayServer.listening ? done() : gatewayServer.once('listening', done))
Object.assign(process.env, { NODE_ENV: 'test', PUBLIC_URL: 'http://127.0.0.1:5279/slide-maker', DATABASE_URL: `file:${join(scratch, 'test.db')}`, SESSION_SECRET: 'disposable-browser-test', CAIL_IDENTITY_JWKS: issuer.jwksJson, CAIL_IDENTITY_ISSUER: issuer.issuer, CAIL_GATEWAY_URL: `http://127.0.0.1:${(gatewayServer.address() as any).port}` })
const { sqlite } = await import('../apps/api/src/db/index.js')
const schema = await import('../apps/api/src/db/schema.js')
const { getTableConfig } = await import(requireApi.resolve('drizzle-orm/sqlite-core'))
for (const table of Object.values(schema)) {
  const config = getTableConfig(table)
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map((column: any) => `"${column.name}" ${column.getSQLType()}`).join(',')})`)
}
sqlite.prepare("INSERT INTO users (id,canonical_subject,email,name,password_hash,email_verified,status,role,created_at) VALUES ('owner',?,'fixture@example.edu','Fixture User','',1,'approved','editor',0)").run(TEST_SUBJECTS.alice)
sqlite.exec("INSERT INTO decks (id,name,slug,metadata,created_by,created_at,updated_at) VALUES ('existing-deck','Existing institutional deck','existing','{}','owner',0,0); INSERT INTO deck_access VALUES ('existing-deck','owner','owner'); INSERT INTO slides (id,deck_id,layout,\"order\",split_ratio,title,created_at,updated_at) VALUES ('slide-one','existing-deck','layout-content',0,'0.45','Existing slide',0,0); INSERT INTO content_blocks (id,slide_id,type,zone,data,\"order\") VALUES ('heading-one','slide-one','heading','main','{\"text\":\"Persisted heading\",\"level\":1}',0)")
const fileId = 'abcdefghijklmnopqrstuvwx'
writeFileSync(join(scratch, 'existing.txt'), 'Existing CUID file contents')
sqlite.prepare('INSERT INTO uploaded_files VALUES (?,?,?,?,?,?,?)').run(fileId, 'existing-deck', 'existing.txt', 'text/plain', join(scratch, 'existing.txt'), 'owner', 0)
const { default: app } = await import('../apps/api/src/app.js')
const apiServer = serve({ hostname: '127.0.0.1', port: 0, fetch: request => app.fetch(request) })
await new Promise<void>(done => apiServer.listening ? done() : apiServer.once('listening', done))
process.env.PUBLIC_API_URL = `http://127.0.0.1:${(apiServer.address() as any).port}`
const { createServer: createViteServer } = await import(join(dirname(requireWeb.resolve('vite/package.json')), 'dist/node/index.js'))
process.chdir(resolve('apps/web'))
const vite = await createViteServer({ server: { port: 5280, strictPort: true, hmr: false } })
await vite.listen()
const edge = createServer((request, response) => {
  const path = request.url ?? '/'
  if (path === '/auth/logout') { response.setHeader('content-type', 'text/html'); response.setHeader('set-cookie', 'fixture-session=; Max-Age=0; HttpOnly; Path=/'); response.end('<h1>Signed out of institutional fixture</h1>'); return }
  if (path === '/health') { response.end('ok'); return }
  if (path === '/fixture/state') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ attempts, cancelled })); return }
  if (path === '/fixture/sign-in') { response.setHeader('content-type', 'text/html'); response.end('<h1>Institutional sign-in fixture</h1><form action="/fixture/complete" method="post"><button>Continue with institutional account</button></form>'); return }
  if (path === '/fixture/complete' && request.method === 'POST') { response.writeHead(303, { location: '/slide-maker/', 'set-cookie': 'fixture-session=verified; HttpOnly; SameSite=Lax; Path=/' }); response.end(); return }
  const api = path.startsWith('/slide-maker/api/')
  const headers = { ...request.headers }
  delete headers['x-cail-identity-jwt']; delete headers['x-cail-gateway-identity-jwt']
  if (headers.cookie?.includes('fixture-session=verified')) { headers['x-cail-identity-jwt'] = appToken; headers['x-cail-gateway-identity-jwt'] = gatewayToken }
  const upstream = httpRequest({ hostname: '127.0.0.1', port: api ? (apiServer.address() as any).port : 5280, path: api ? path.slice('/slide-maker'.length) : path, method: request.method, headers }, result => { response.writeHead(result.statusCode ?? 500, result.headers); result.pipe(response) })
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end() })
  response.on('close', () => upstream.destroy())
  request.pipe(upstream)
})
edge.listen(5279, '127.0.0.1')
async function close() { edge.closeAllConnections(); edge.close(); apiServer.closeAllConnections(); apiServer.close(); gatewayServer.closeAllConnections(); gatewayServer.close(); await vite.close(); sqlite.close(); rmSync(scratch, { recursive: true, force: true }); process.exit(0) }
process.on('SIGTERM', close); process.on('SIGINT', close)
