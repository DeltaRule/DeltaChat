'use strict'

import { URL } from 'url'

/**
 * Checks whether a URL is safe to make outbound HTTP requests to.
 *
 * Blocks:
 * - Non-HTTP/HTTPS schemes (file://, ftp://, etc.)
 * - Private RFC-1918 address ranges: 10.x, 172.16-31.x, 192.168.x
 * - IPv6 private/link-local ranges: ::1, fc00::/7, fe80::/10
 * - Loopback addresses (127.x.x.x, ::1, localhost)
 * - Metadata service IPs (169.254.x.x / AWS 169.254.169.254)
 * - URLs with credentials (user:pass@host)
 *
 * @returns true if the URL is safe to request, false otherwise
 */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  // Only allow HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  // Reject URLs with embedded credentials
  if (parsed.username || parsed.password) {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()

  // Reject loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false
  }

  // Reject IPv4 private / link-local ranges
  const ipv4Parts = hostname.split('.')
  if (ipv4Parts.length === 4) {
    const [a, b] = ipv4Parts.map(Number)
    // 10.0.0.0/8
    if (a === 10) return false
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return false
    // 192.168.0.0/16
    if (a === 192 && b === 168) return false
    // 127.0.0.0/8 (loopback range beyond 127.0.0.1)
    if (a === 127) return false
    // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 169 && b === 254) return false
  }

  // Reject IPv6 private / link-local ranges
  // Strip brackets from IPv6 literals like [::1]
  const ipv6Host =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

  if (
    ipv6Host.startsWith('::1') ||
    ipv6Host.toLowerCase().startsWith('fc') ||
    ipv6Host.toLowerCase().startsWith('fd') ||
    ipv6Host.toLowerCase().startsWith('fe80')
  ) {
    return false
  }

  return true
}

/**
 * Returns true when the URL points to a loopback address, private RFC-1918
 * range, or link-local address (i.e. the inverse of what isAllowedExternalUrl
 * permits).  Only inspects hostname — does NOT validate scheme or credentials.
 */
export function isPrivateOrLocalhost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true

  const ipv4Parts = hostname.split('.')
  if (ipv4Parts.length === 4) {
    const [a, b] = ipv4Parts.map(Number)
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
  }

  const ipv6Host =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

  if (
    ipv6Host.startsWith('::1') ||
    ipv6Host.toLowerCase().startsWith('fc') ||
    ipv6Host.toLowerCase().startsWith('fd') ||
    ipv6Host.toLowerCase().startsWith('fe80')
  ) {
    return true
  }

  return false
}
