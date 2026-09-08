import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Actual pinned Gateway receiver over loopback HTTP. Only Cloudflare's unused
// WorkerEntrypoint export is shimmed for Node; Registry, Secrets Store, Workers
// model discovery and the external provider/analytics transport are synthetic.
// This is not Workerd, a deployed-path check, or a real-provider acceptance run.
// Run with CAIL_GATEWAY_SOURCE pointing at a frozen-installed exact checkout.
const SHA = process.env.CAIL_GATEWAY_SHA ?? 'f3a8b3cc4b6b8bc99125771da6a907dffbdb07c3'
const gatewayRepo = process.env.CAIL_GATEWAY_SOURCE
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url))
let scratch: string
const MODEL = '@cf/openai/gpt-oss-120b'
let app: any, sqlite: any, server: any, issuer: any, alice: string, bob: string
let mode: 'success' | 'quota' | 'trailing-error' | 'abort' = 'success'
let modelText = 'Hello'
let attempts = 0
let providerAborted = false
const received: Request[] = []
const providerRequests: Request[] = []
const receiverResponses: Response[] = []
let appToken: string, gatewayToken: string

describe.skipIf(!gatewayRepo)('actual pinned Gateway receiver (requires CAIL_GATEWAY_SOURCE)', () => {
beforeAll(async () => {
  if (!gatewayRepo) throw new Error('Set CAIL_GATEWAY_SOURCE to a Gateway checkout installed with bun install --frozen-lockfile')
  const requireGateway = createRequire(join(gatewayRepo, 'package.json'))
  scratch = mkdtempSync(join(tmpdir(), 'slide-gateway-integration-'))
  const archive = execFileSync('git', ['-C', gatewayRepo, 'archive', SHA, 'src'])
  execFileSync('tar', ['-x', '-C', scratch], { input: archive })
  const manifest = JSON.parse(execFileSync('git', ['-C', gatewayRepo, 'show', `${SHA}:package.json`], { encoding: 'utf8' }))
  const installedIdentity = JSON.parse(readFileSync(join(gatewayRepo, 'node_modules/@cuny-ai-lab/cail-identity/package.json'), 'utf8'))
  expect(installedIdentity.version, 'Gateway dependencies must match the pinned receiver manifest').toBe(manifest.dependencies['@cuny-ai-lab/cail-identity'])
  const { buildSync } = requireGateway('esbuild')
  writeFileSync(join(scratch, 'workers-shim.ts'), 'export class WorkerEntrypoint {}')
  buildSync({ entryPoints: [join(scratch, 'src/index.ts')], bundle: true, platform: 'node', format: 'esm', outfile: join(scratch, 'receiver.mjs'), nodePaths: [join(gatewayRepo, 'node_modules')], alias: { 'cloudflare:workers': join(scratch, 'workers-shim.ts') } })
  const receiver = await import(/* @vite-ignore */ pathToFileURL(join(scratch, 'receiver.mjs')).href)
  const identity = await import(requireApi.resolve('@cuny-ai-lab/cail-identity/testing'))
  issuer = await identity.createTestIdentityIssuer()
  alice = identity.TEST_SUBJECTS.alice
  bob = identity.TEST_SUBJECTS.bob
  appToken = await issuer.mintIdentityJwt({ audience: 'cail:slide-maker' })
  gatewayToken = await issuer.mintIdentityJwt({ audience: 'cail:gateway' })
  const env = {
    CAIL_GATEWAY_AUDIENCE: 'cail:gateway', CAIL_IDENTITY_ISSUER: issuer.issuer, CAIL_IDENTITY_JWKS: issuer.jwksJson,
    MODEL_ACCESS_REGISTRY_GATEWAY: { resolveDoorwayAccess: async () => ({ ok: true, scope: 'models:invoke models:read quota:read', budgetScope: 'person' }) },
    AI_GATEWAY_ID: 'cail-model-api', CF_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    CF_AIG_AUTH_TOKEN_STORE: { get: async () => 'synthetic-token-at-least-twenty-characters' },
    MODEL_SOURCES: 'workers-ai', MODEL_CATALOG_MAX_STALE_SECONDS: '3600', CAIL_LOG_ENV: 'test',
    AI: { models: async () => [{ name: MODEL, properties: [{ property_id: 'context_window', value: '128000' }] }] },
  }
  const syntheticFetch = async (input: any, init?: RequestInit) => {
    const request = new Request(input, init)
    if (request.url.endsWith('/ai-gateway/gateways/cail-model-api')) return Response.json({ success: true, result: { spend_limits: { enabled: true, rules: [{ enabled: true, limitType: 'cost', limit: 5, window: 2592000, technique: 'fixed', metadata: { user_id: { mode: 'partition' }, budget_scope: { mode: 'filter', values: ['person'] } } }] } } })
    if (request.url.endsWith('/graphql')) return Response.json({ data: { viewer: { accounts: [{ aiGatewayRequestsAdaptiveGroups: [{ dimensions: { metadataRaw: JSON.stringify({ user_id: alice, budget_scope: 'person' }) }, sum: { cost: 1.25 } }] }] } }, errors: [] })
    if (!request.url.endsWith('/ai/v1/chat/completions')) throw new Error(`Unconfigured synthetic transport: ${request.url}`)
    attempts++
    providerRequests.push(request)
    if (mode === 'quota') return Response.json({ error: { code: 'quota_exceeded', message: 'private provider detail' } }, { status: 429 })
    const encoder = new TextEncoder()
    const text = `data: ${JSON.stringify({ choices: [{ delta: { content: modelText } }] })}\r\n\r\ndata: [DONE]\r\n\r\ndata: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":1,"total_tokens":5}}\r\n\r\n` + (mode === 'trailing-error' ? 'data: {"error":{"message":"private provider detail"}}\n\n' : '')
    return new Response(new ReadableStream({
      start(controller) {
        if (mode === 'abort') {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"started"}}]}\n\n'))
          request.signal.addEventListener('abort', () => { providerAborted = true; controller.close() }, { once: true })
        } else {
          for (let index = 0; index < text.length; index += 7) controller.enqueue(encoder.encode(text.slice(index, index + 7)))
          controller.close()
        }
      },
      cancel() { providerAborted = true },
    }), { headers: { 'content-type': 'text/event-stream' } })
  }
  const { serve } = await import(requireApi.resolve('@hono/node-server'))
  server = serve({ hostname: '127.0.0.1', port: 0, fetch: async (request: Request) => { received.push(request); const response = await receiver.handleRequest(request, env, { fetch: syntheticFetch, now: Date.now }); receiverResponses.push(response); return response } })
  await new Promise<void>(done => server.listening ? done() : server.once('listening', done))
  vi.stubEnv('CAIL_GATEWAY_URL', `http://127.0.0.1:${server.address().port}`)
  vi.stubEnv('CAIL_IDENTITY_JWKS', issuer.jwksJson)
  vi.stubEnv('CAIL_IDENTITY_ISSUER', issuer.issuer)
  vi.stubEnv('DATABASE_URL', 'file::memory:')
  vi.stubEnv('SESSION_SECRET', 'test-only')
  vi.stubEnv('NODE_ENV', 'test')
  ;({ sqlite } = await import('../apps/api/src/db/index'))
  const schema = await import('../apps/api/src/db/schema')
  const { getTableConfig } = await import(requireApi.resolve('drizzle-orm/sqlite-core'))
  for (const table of Object.values(schema)) {
    const config = getTableConfig(table)
    sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map((column: any) => `"${column.name}" ${column.getSQLType()}`).join(',')})`)
  }
  sqlite.prepare("INSERT INTO users (id,canonical_subject,email,name,password_hash,email_verified,status,role,created_at) VALUES ('owner',?,'test@example.edu','Test','',1,'approved','editor',0)").run(alice)
  sqlite.exec("INSERT INTO decks (id,name,slug,metadata,created_by,created_at,updated_at) VALUES ('deck','Test','test','{}','owner',0,0); INSERT INTO deck_access VALUES ('deck','owner','owner')")
  ;({ default: app } = await import('../apps/api/src/app'))
}, 30000)

afterAll(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(done => server.close(done)) }
  sqlite?.close()
  vi.unstubAllEnvs()
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

function headers(appJwt = appToken, gatewayJwt = gatewayToken) {
  return { 'content-type': 'application/json', 'x-cail-identity-jwt': appJwt, 'x-cail-gateway-identity-jwt': gatewayJwt }
}
function chat(signal?: AbortSignal) {
  return app.request('/api/chat', { method: 'POST', headers: headers(), body: JSON.stringify({ message: 'Hello', deckId: 'deck', modelId: MODEL }), signal })
}

it('uses separate audience-bound identities and denies mismatches before receiver/provider access', async () => {
  const before = received.length
  const other = await issuer.mintIdentityJwt({ audience: 'cail:gateway', subject: bob })
  for (const candidate of [headers(gatewayToken, appToken), headers(appToken, other)]) {
    expect((await app.request('/api/providers/quota', { headers: candidate })).status).toBe(401)
  }
  expect(received).toHaveLength(before)
  expect(attempts).toBe(0)
})

it('loads actual Gateway catalog and quota through Slide routes', async () => {
  const catalog = await app.request('/api/providers', { headers: headers() })
  expect(catalog.status).toBe(200)
  expect(await catalog.json()).toMatchObject({ models: [{ id: MODEL }] })
  const quota = await app.request('/api/providers/quota', { headers: headers() })
  expect(quota.status).toBe(200)
  expect(await quota.json()).toMatchObject({ limit: 5000000, estimated_used: 1250000 })
})

it('streams split CRLF frames through receiver to persistence and correlates request/trace/session', async () => {
  const response = await chat()
  const body = await response.text()
  expect(body).toContain('"content":"Hello"')
  expect(body).toContain('"type":"done"')
  expect(sqlite.prepare("SELECT content FROM chat_messages WHERE role='assistant'").all()).toEqual([{ content: 'Hello' }])
  const request = received.findLast(request => request.url.endsWith('/chat/completions'))!
  expect(request.headers.get('x-cail-request-id')).toMatch(/^[0-9a-f-]{36}$/)
  expect(receiverResponses.at(-1)!.headers.get('x-cail-request-id')).toBe(request.headers.get('x-cail-request-id'))
  expect(request.headers.get('x-cail-identity-jwt')).toBe(gatewayToken)
  expect(request.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/)
  expect(request.headers.get('x-cail-session-id')).toBe('deck')
  const metadata = JSON.parse(providerRequests.at(-1)!.headers.get('cf-aig-metadata')!)
  expect(metadata.user_id).toBe(alice)
  expect(metadata.budget_scope).toBe('person')
})

it('quota refusal makes one provider attempt and returns only a safe correlation ID', async () => {
  mode = 'quota'
  const before = attempts
  const body = await (await chat()).text()
  expect(attempts - before).toBe(1)
  expect(body).toContain('"type":"error"')
  expect(body).not.toContain('private provider detail')
  expect(body).toMatch(/"requestId":"[0-9a-f-]{36}"/)
})

it('trailing provider errors invalidate completion and do not persist assistant output', async () => {
  mode = 'trailing-error'
  const body = await (await chat()).text()
  expect(body).toContain('"type":"error"')
  expect(body).not.toContain('"type":"done"')
  expect(body).not.toContain('private provider detail')
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM chat_messages WHERE role='assistant'").get().count).toBe(1)
})

it('propagates caller abort through HTTP receiver to synthetic provider', async () => {
  mode = 'abort'
  const controller = new AbortController()
  const response = await chat(controller.signal)
  const reader = response.body.getReader()
  await reader.read()
  controller.abort()
  await reader.cancel()
  await vi.waitFor(() => expect(providerAborted).toBe(true))
})

it('generates a balanced plan through Gateway with caller correlation, then applies the returned plan', async () => {
  mode = 'success'
  modelText = JSON.stringify({ slides: [{ layout: 'layout-content', title: 'Course introduction', modules: [{ type: 'text', zone: 'main', data: { text: 'Learning objectives' } }] }], omissions: [] })
  const sourcePath = join(scratch, 'outline.md')
  writeFileSync(sourcePath, '# Course introduction\n\n## Learning objectives\n\nUnderstand the course structure.\n')
  sqlite.prepare("INSERT INTO uploaded_files (id,deck_id,path,mime_type,filename) VALUES ('outline','deck',?,'text/markdown','outline.md')").run(sourcePath)
  const requestId = '018f1f50-7c21-7abc-9def-0123456789ab'
  const traceparent = '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01'
  const before = attempts
  const response = await app.request('/api/decks/deck/plan', {
    method: 'POST', headers: { ...headers(), 'x-cail-request-id': requestId, traceparent },
    body: JSON.stringify({ fileId: 'outline', fidelity: 'balanced', modelId: MODEL }),
  })
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result).toMatchObject({ plan: { fidelity: 'balanced', slides: [{ layout: 'layout-content', title: 'Course introduction' }] }, hasExistingSlides: false })
  expect(attempts - before).toBe(1)
  const request = received.at(-1)!
  expect(request.headers.get('x-cail-identity-jwt')).toBe(gatewayToken)
  expect(request.headers.get('x-cail-request-id')).toBe(requestId)
  expect(request.headers.get('traceparent')).toMatch(/^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/)
  expect(request.headers.get('traceparent')).not.toBe(traceparent)
  expect(request.headers.get('x-cail-session-id')).toBe('deck')
  expect(receiverResponses.at(-1)!.headers.get('x-cail-request-id')).toBe(requestId)
  // Generation is a preview; only the user's apply action materializes it.
  expect(sqlite.prepare('SELECT COUNT(*) AS count FROM slides').get().count).toBe(0)
  const applied = await app.request('/api/decks/deck/plan/apply', {
    method: 'POST', headers: headers(), body: JSON.stringify({ plan: result.plan, outlineFileId: 'outline' }),
  })
  expect(applied.status).toBe(201)
  expect(sqlite.prepare('SELECT layout FROM slides').all()).toEqual([{ layout: 'layout-content' }])
  expect(JSON.parse(sqlite.prepare('SELECT data FROM content_blocks').get().data)).toEqual({ text: 'Learning objectives' })
  expect(JSON.parse(sqlite.prepare("SELECT metadata FROM decks WHERE id='deck'").get().metadata)).toMatchObject({ fidelity: 'balanced', outlineFileId: 'outline' })
  expect(attempts - before).toBe(1)
})

it('plan quota refusal returns a safe correlated error without retry or persisted changes', async () => {
  mode = 'quota'
  const before = attempts
  const beforeSlides = sqlite.prepare('SELECT * FROM slides').all()
  const beforeDeck = sqlite.prepare("SELECT * FROM decks WHERE id='deck'").get()
  const response = await app.request('/api/decks/deck/plan', {
    method: 'POST', headers: headers(), body: JSON.stringify({ fileId: 'outline', fidelity: 'balanced', modelId: MODEL }),
  })
  expect(response.status).toBe(429)
  const result = await response.json()
  expect(result.requestId).toBe(received.at(-1)!.headers.get('x-cail-request-id'))
  expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/)
  expect(JSON.stringify(result)).not.toContain('private provider detail')
  expect(Object.keys(result).sort()).toEqual(['message', 'requestId'])
  expect(attempts - before).toBe(1)
  expect(sqlite.prepare('SELECT * FROM slides').all()).toEqual(beforeSlides)
  expect(sqlite.prepare("SELECT * FROM decks WHERE id='deck'").get()).toEqual(beforeDeck)
})

})
