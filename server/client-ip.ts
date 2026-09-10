// The requester's network identity for the abuse boxes (seed + creation caps, the tripwire).
//
// Exactly ONE header is trusted: `X-Real-IP`, which the app.stakes.day Caddy vhost SETS on every
// proxied request (`header_up X-Real-IP {client_ip}`), overwriting anything the client sent. Never
// read the FIRST X-Forwarded-For entry: behind a trusted upstream Caddy APPENDS to it, so `[0]`
// becomes attacker-controlled the day a CDN sits in front. With no proxy at all, the socket peer is
// the client. Verified on the box 2026-09-10 (AUDIT-CYCLE-II.md §9.2):
//   - Caddy 2.11 with no trusted_proxies OVERWRITES an inbound X-Forwarded-For with the peer IP;
//   - a client-sent X-Real-IP passes THROUGH untouched unless the vhost sets it — so this module
//     must never run behind a vhost that lacks the header_up line (DEPLOYMENT.md §5).
import { createHash } from 'node:crypto'

export interface IpSource {
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim()
/** Node reports IPv4 peers as `::ffff:1.2.3.4`; Caddy reports `1.2.3.4`. One form, one fingerprint. */
const canon = (ip: string) => ip.replace(/^::ffff:/i, '')

export function clientIp(req: IpSource): string {
  const real = one(req.headers['x-real-ip'])
  if (real) return canon(real)
  const xff = one(req.headers['x-forwarded-for'])
  if (xff) {
    // The LAST hop is the one the proxy we control appended; the first is whatever the client sent.
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return canon(parts[parts.length - 1])
  }
  return canon(req.socket?.remoteAddress || '?')
}

/** Requester fingerprint: hashed client IP, never stored raw. The salt is unchanged from the original
 *  seed box so fingerprints stay comparable across the 2026-09-10 deploy (a day's counts carry over). */
export function requesterHash(req: IpSource): string {
  return createHash('sha256').update(`stakes-seed:${clientIp(req)}`).digest('hex').slice(0, 16)
}
