import { lookup } from 'node:dns/promises'

const IPV4_MAPPED_PREFIX = '::ffff:'

/** Private/reserved IPv4 CIDR ranges that must not be accessed by server-side fetches. */
const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [0x7F000000, 0xFF000000], // 127.0.0.0/8   loopback
  [0x0A000000, 0xFF000000], // 10.0.0.0/8     RFC 1918
  [0xAC100000, 0xFFF00000], // 172.16.0.0/12  RFC 1918
  [0xC0A80000, 0xFFFF0000], // 192.168.0.0/16 RFC 1918
  [0xA9FE0000, 0xFFFF0000], // 169.254.0.0/16 link-local (AWS metadata)
  [0x00000000, 0xFF000000], // 0.0.0.0/8      current network
]

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.')
  return ((+parts[0] << 24) | (+parts[1] << 16) | (+parts[2] << 8) | +parts[3]) >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  return PRIVATE_IPV4_RANGES.some(([network, mask]) => ((n & mask) >>> 0) === network)
}

/** Returns true if the IP address belongs to a private, loopback, or reserved range. */
export function isPrivateIp(ip: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return isPrivateIpv4(ip)
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX)) {
    const v4 = ip.slice(IPV4_MAPPED_PREFIX.length)
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
      return isPrivateIpv4(v4)
    }
  }

  // IPv6 loopback
  if (ip === '::1') return true

  // IPv6 unique local address (fc00::/7)
  if (/^f[cd]/i.test(ip)) return true

  // IPv6 link-local (fe80::/10)
  if (/^fe[89ab]/i.test(ip)) return true

  return false
}

/**
 * Validates a URL is safe to fetch (not targeting private/internal resources).
 * Returns the resolved IP so callers can pin the connection (mitigates DNS rebinding).
 */
export async function validateUrlForSsrf(url: string): Promise<{ resolvedIp: string }> {
  const parsed = new URL(url)

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }

  const hostname = parsed.hostname

  // Reject bare IPv4 literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('URL points to a private IP address')
    }
    return { resolvedIp: hostname }
  }

  // Reject bracketed IPv6 literals
  if (hostname.startsWith('[') || /^[0-9a-f:]+$/i.test(hostname)) {
    throw new Error('IPv6 literal URLs are not allowed')
  }

  // DNS-resolve and check the resolved IP
  const { address } = await lookup(hostname)
  if (isPrivateIp(address)) {
    throw new Error('URL resolves to a private IP address')
  }

  // Double-resolve to mitigate DNS rebinding TOCTOU
  const { address: address2 } = await lookup(hostname)
  if (isPrivateIp(address2)) {
    throw new Error('URL resolves to a private IP address (rebind check)')
  }

  return { resolvedIp: address }
}
