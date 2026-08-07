import { isIP } from 'node:net'

export const DEFAULT_API_HOST = '127.0.0.1'

function normalizeHost(value: string | undefined): string {
  const host = value?.trim() || DEFAULT_API_HOST

  // URL-style brackets are useful in configuration files but are not part of
  // the hostname passed to node's server listener.
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1)
  return host
}

function assertValidHost(host: string): void {
  if (host === 'localhost' || isIP(host) !== 0) return
  throw new Error('API_HOST must be localhost or a valid IP address')
}

/**
 * Resolve the API listener without making a production process publicly
 * reachable. Development may opt into a wildcard listener explicitly for
 * device testing; production requires the IPv4 loopback used by Nginx.
 */
export function resolveApiHost(
  value = process.env.API_HOST,
  nodeEnv = process.env.NODE_ENV,
): string {
  const host = normalizeHost(value)
  assertValidHost(host)

  if (nodeEnv === 'production' && host !== DEFAULT_API_HOST) {
    throw new Error(`API_HOST must be ${DEFAULT_API_HOST} in production`)
  }

  return host
}
