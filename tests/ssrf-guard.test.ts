import { describe, it, expect, vi } from 'vitest'
import { isPrivateIp } from '../apps/api/src/utils/ssrf-guard'

describe('isPrivateIp', () => {
  const privateCases: [string, boolean][] = [
    // IPv4 private/reserved
    ['127.0.0.1', true],
    ['127.255.255.255', true],
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.1.1', true],
    ['192.168.255.255', true],
    ['169.254.169.254', true],  // AWS metadata
    ['169.254.0.1', true],
    ['0.0.0.0', true],
    ['0.255.255.255', true],

    // IPv4 public
    ['172.32.0.1', false],
    ['8.8.8.8', false],
    ['1.2.3.4', false],
    ['104.16.0.1', false],

    // IPv6
    ['::1', true],

    // IPv4-mapped IPv6
    ['::ffff:127.0.0.1', true],
    ['::ffff:10.0.0.1', true],
    ['::ffff:192.168.1.1', true],
    ['::ffff:8.8.8.8', false],

    // IPv6 unique local
    ['fc00::1', true],
    ['fd12:3456::1', true],

    // IPv6 link-local
    ['fe80::1', true],

    // IPv6 public
    ['2001:4860:4860::8888', false],
  ]

  for (const [ip, expected] of privateCases) {
    it(`${ip} → ${expected ? 'private' : 'public'}`, () => {
      expect(isPrivateIp(ip)).toBe(expected)
    })
  }
})

describe('validateUrlForSsrf', () => {
  async function getValidator() {
    // Mock DNS to avoid real network/DNS lookups in CI or restricted sandboxes
    vi.resetModules()
    vi.doMock('node:dns/promises', () => ({
      lookup: async (hostname: string) => {
        if (hostname === 'localhost') return { address: '127.0.0.1', family: 4 }
        // Treat example.com and other hosts as public IPv4
        return { address: '93.184.216.34', family: 4 }
      },
    }))
    const mod = await import('../apps/api/src/utils/ssrf-guard')
    return mod.validateUrlForSsrf
  }

  it('allows public HTTPS URLs', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('https://example.com/image.png')).resolves.toBeUndefined()
  })

  it('rejects loopback IP literal', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('http://127.0.0.1/')).rejects.toThrow()
  })

  it('rejects private IP literal', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('http://10.0.0.1/')).rejects.toThrow()
  })

  it('rejects IPv6 literal', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('http://[::1]/')).rejects.toThrow()
  })

  it('rejects localhost (resolves to 127.0.0.1)', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('http://localhost/')).rejects.toThrow()
  })

  it('rejects non-HTTP schemes', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('ftp://example.com/file')).rejects.toThrow()
  })

  it('rejects AWS metadata IP', async () => {
    const validateUrlForSsrf = await getValidator()
    await expect(validateUrlForSsrf('http://169.254.169.254/latest/meta-data/')).rejects.toThrow()
  })
})
