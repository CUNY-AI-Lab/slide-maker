import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '../apps/api/node_modules/hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { loadIdentityConfigs, verifyRequestIdentity } from '../apps/api/src/auth/identity'
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url))
const { createTestIdentityIssuer, TEST_SUBJECTS } = await import(requireApi.resolve('@cuny-ai-lab/cail-identity/testing'))

vi.mock('../apps/api/src/email/index', () => ({ sendDeckSharedEmail: vi.fn().mockResolvedValue(undefined), sendAdminPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())

describe('CAIL keyring verification', () => {
  it('verifies both audience-bound tokens and rejects mismatched, expired, swapped and malformed legs', async () => {
    const issuer = await createTestIdentityIssuer()
    vi.stubEnv('CAIL_IDENTITY_JWKS', issuer.jwksJson)
    vi.stubEnv('CAIL_IDENTITY_ISSUER', issuer.issuer)
    const configs = await loadIdentityConfigs()
    const app = await issuer.mintIdentityJwt({ audience: 'cail:slide-maker' })
    const gateway = await issuer.mintIdentityJwt({ audience: 'cail:gateway' })
    const headers = (appJwt: string, gatewayJwt?: string) => new Headers({ 'x-cail-identity-jwt': appJwt, ...(gatewayJwt ? { 'x-cail-gateway-identity-jwt': gatewayJwt } : {}) })
    expect(await verifyRequestIdentity(headers(app, gateway), configs)).toEqual({ subject: TEST_SUBJECTS.alice, gatewayToken: gateway })
    expect(await verifyRequestIdentity(headers(app), configs)).toEqual({ subject: TEST_SUBJECTS.alice, gatewayToken: undefined })
    const other = await issuer.mintIdentityJwt({ audience: 'cail:gateway', subject: TEST_SUBJECTS.bob })
    const expired = await issuer.mintIdentityJwt({ audience: 'cail:gateway', now: 1000 })
    for (const candidate of [headers(app, other), headers(app, expired), headers(gateway, app), headers(app, 'bad'), new Headers()]) {
      expect(await verifyRequestIdentity(candidate, configs)).toBeNull()
    }
  })
  it('fails configuration closed', async () => {
    vi.stubEnv('CAIL_IDENTITY_JWKS', '')
    await expect(loadIdentityConfigs()).rejects.toThrow('Invalid CAIL identity')
  })
})

it('production auth keeps local authority and blocks unmapped subjects and legacy cookies', async () => {
  vi.stubEnv('DATABASE_URL', 'file::memory:')
  vi.stubEnv('SESSION_SECRET', 'test-only')
  vi.stubEnv('NODE_ENV', 'production')
  const issuer = await createTestIdentityIssuer()
  vi.stubEnv('CAIL_IDENTITY_JWKS', issuer.jwksJson)
  vi.stubEnv('CAIL_IDENTITY_ISSUER', issuer.issuer)
  const { Hono } = await import(requireApi.resolve('hono'))
  const { authMiddleware } = await import('../apps/api/src/middleware/auth')
  const { sqlite } = await import('../apps/api/src/db/index')
  sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, canonical_subject TEXT UNIQUE, email TEXT, name TEXT, password_hash TEXT, email_verified INTEGER, status TEXT, role TEXT, token_cap INTEGER, token_cap_reset_date INTEGER, created_at INTEGER)`)
  sqlite.prepare("INSERT INTO users VALUES (?, ?, ?, ?, '', 1, 'approved', 'viewer', 1000, NULL, 0)").run('existing-owner', TEST_SUBJECTS.alice, 'alice@example.edu', 'Local Alice')
  const app = new Hono()
  app.use('*', authMiddleware)
  app.get('/', (c: Context) => c.json(c.get('user')))
  const token = await issuer.mintIdentityJwt({ audience: 'cail:slide-maker', email: 'different@example.edu', entitlements: ['admin'] })
  const response = await app.request('/', { headers: { 'x-cail-identity-jwt': token } })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ id: 'existing-owner', role: 'viewer', email: 'alice@example.edu' })
  const unmapped = await issuer.mintIdentityJwt({ audience: 'cail:slide-maker', subject: TEST_SUBJECTS.bob, email: 'alice@example.edu' })
  expect((await app.request('/', { headers: { 'x-cail-identity-jwt': unmapped } })).status).toBe(403)
  expect((await app.request('/', { headers: { cookie: 'auth_session=legacy' } })).status).toBe(401)
  const { default: sharing } = await import('../apps/api/src/routes/sharing')
  const { default: admin } = await import('../apps/api/src/routes/admin')
  const { default: files } = await import('../apps/api/src/routes/files')
  const { default: auth } = await import('../apps/api/src/routes/auth')
  const routes = new Hono()
  routes.route('/decks', files)
  routes.route('/decks', sharing)
  routes.route('/admin', admin)
  routes.route('/auth', auth)
  sqlite.exec("CREATE TABLE decks (id TEXT PRIMARY KEY, name TEXT); CREATE TABLE deck_access (deck_id TEXT, user_id TEXT, role TEXT); INSERT INTO decks VALUES ('existing-deck','Saved deck'); INSERT INTO deck_access VALUES ('existing-deck','existing-owner','owner'), ('existing-deck','existing-reader','viewer')")
  sqlite.prepare("INSERT INTO users VALUES (?, ?, ?, ?, '', 1, 'approved', 'viewer', 1000, NULL, 0)").run('existing-reader', TEST_SUBJECTS.bob, 'bob@example.edu', 'Local Bob')
  const ownerHeaders = { 'x-cail-identity-jwt': token, 'content-type': 'application/json' }
  const readerHeaders = { 'x-cail-identity-jwt': unmapped, 'content-type': 'application/json' }
  expect((await routes.request('/admin/users', { headers: ownerHeaders })).status).toBe(403)
  sqlite.prepare("UPDATE users SET role = 'admin' WHERE id = 'existing-owner'").run()
  expect((await routes.request('/admin/users', { headers: ownerHeaders })).status).toBe(200)
  expect((await routes.request('/auth/login', { method: 'POST', body: '{}' })).status).toBe(403)
  const collaborators = await routes.request('/decks/existing-deck/collaborators', { headers: readerHeaders })
  expect(collaborators.status).toBe(200)
  expect((await collaborators.json()).collaborators.map((entry: { userId: string }) => entry.userId)).toEqual(['existing-owner', 'existing-reader'])
  expect((await routes.request('/decks/existing-deck/share', { method: 'POST', headers: readerHeaders, body: JSON.stringify({ email: 'alice@example.edu', role: 'editor' }) })).status).toBe(403)
  expect((await routes.request('/decks/existing-deck/share', { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ email: 'bob@example.edu', role: 'viewer' }) })).status).toBe(200)
  const fixtureDir = mkdtempSync(join(tmpdir(), 'slide-identity-'))
  try {
    const filePath = join(fixtureDir, 'saved.txt')
    writeFileSync(filePath, 'Existing uploaded content')
    sqlite.exec('CREATE TABLE uploaded_files (id TEXT PRIMARY KEY, deck_id TEXT, filename TEXT, mime_type TEXT, path TEXT, uploaded_by TEXT, created_at INTEGER)')
    sqlite.prepare("INSERT INTO uploaded_files VALUES (?, ?, ?, ?, ?, 'existing-owner', 0)").run('cmexistingfile12345678901', 'existing-deck', 'saved.txt', 'text/plain', filePath)
    const fileUrl = '/decks/existing-deck/files/cmexistingfile12345678901'
    const publicFile = await routes.request(fileUrl)
    expect(publicFile.status).toBe(200)
    expect(await publicFile.text()).toBe('Existing uploaded content')
    const listing = await routes.request('/decks/existing-deck/files', { headers: readerHeaders })
    expect(listing.status).toBe(200)
    expect((await listing.json()).files[0].url).toBe('/api' + fileUrl)
    expect((await routes.request(fileUrl, { method: 'DELETE', headers: readerHeaders })).status).toBe(403)
  } finally {
    rmSync(fixtureDir, { recursive: true })
    sqlite.close()
  }
})
