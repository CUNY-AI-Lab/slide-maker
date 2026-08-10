import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_API_HOST, resolveApiHost } from '../apps/api/src/listen-host'

describe('listener boundaries', () => {
  it('defaults production API listeners to IPv4 loopback', () => {
    expect(resolveApiHost(undefined, 'production')).toBe(DEFAULT_API_HOST)
    expect(resolveApiHost(DEFAULT_API_HOST, 'production')).toBe(DEFAULT_API_HOST)
  })

  it('rejects wildcard listeners in production but allows an explicit dev override', () => {
    expect(() => resolveApiHost('0.0.0.0', 'production')).toThrow(/127\.0\.0\.1/)
    expect(() => resolveApiHost('::1', 'production')).toThrow(/127\.0\.0\.1/)
    expect(resolveApiHost('0.0.0.0', 'development')).toBe('0.0.0.0')
    expect(resolveApiHost('::', 'development')).toBe('::')
  })

  it('rejects malformed listener values', () => {
    expect(() => resolveApiHost('not a host', 'development')).toThrow(/valid IP/)
    expect(() => resolveApiHost('http://127.0.0.1', 'development')).toThrow(/valid IP/)
  })

  it('keeps Vite and the documented production process on loopback', () => {
    const viteConfig = readFileSync(resolve(import.meta.dirname, '../apps/web/vite.config.ts'), 'utf8')
    const deploymentSpec = readFileSync(resolve(import.meta.dirname, '../CLAUDE.md'), 'utf8')
    const processScript = readFileSync(resolve(import.meta.dirname, '../scripts/staging-processes.sh'), 'utf8')
    const deployScript = readFileSync(resolve(import.meta.dirname, '../deploy-staging.sh'), 'utf8')
    const nginxConfig = readFileSync(resolve(import.meta.dirname, '../nginx/slide-maker.conf'), 'utf8')

    expect(viteConfig.match(/host: '127\.0\.0\.1'/g)).toHaveLength(2)
    expect(deploymentSpec).toContain('scripts/staging-processes.sh')
    expect(processScript).toContain('API_HOST="$API_HOST" API_PORT="$API_PORT"')
    expect(processScript).toContain('preview --host "$API_HOST" --port "$WEB_PORT"')
    expect(deployScript).toContain('/data/slide-maker/scripts/staging-processes.sh')
    expect(nginxConfig).toContain('proxy_pass http://127.0.0.1:4173/')
    expect(nginxConfig).toContain('proxy_pass http://127.0.0.1:3004/api/')
  })
})
