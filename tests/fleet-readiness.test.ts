import { afterEach, describe, expect, it, vi } from 'vitest'
import { readinessRouter } from '../apps/api/src/fleet/readiness.js'

afterEach(() => vi.unstubAllEnvs())
describe('private release readiness', () => {
  it('conceals state without the operator token', async () => {
    vi.stubEnv('READINESS_TOKEN', 'operator-secret')
    const check = vi.fn()
    const app = readinessRouter(check, check)
    expect((await app.request('/ready')).status).toBe(404)
    expect((await app.request('/ready', { headers: { authorization: 'Bearer wrong' } })).status).toBe(404)
    expect(check).not.toHaveBeenCalled()
  })
  it('awaits identity configuration and checks migrated storage before returning the exact release', async () => {
    vi.stubEnv('READINESS_TOKEN', 'operator-secret')
    vi.stubEnv('RELEASE_SHA', 'a'.repeat(40))
    vi.stubEnv('CAIL_GATEWAY_URL', 'https://tools.ailab.gc.cuny.edu')
    const headers = { authorization: 'Bearer operator-secret' }
    const missingIdentity = readinessRouter(() => {}, async () => { throw new Error('private configuration details') })
    expect(await (await missingIdentity.request('/ready', { headers })).json()).toEqual({ status: 'not_ready' })
    const missingMigration = readinessRouter(() => { throw new Error('no column') }, async () => {})
    expect((await missingMigration.request('/ready', { headers })).status).toBe(503)
    const app = readinessRouter(() => {}, async () => {})
    expect(await (await app.request('/ready', { headers })).json()).toEqual({ status: 'ready', release: 'a'.repeat(40), service: 'slide-maker' })
    vi.stubEnv('RELEASE_SHA', 'main')
    expect((await app.request('/ready', { headers })).status).toBe(503)
  })
})
