// The requester identity (server/client-ip.ts): only the proxy-set X-Real-IP is trusted; the LAST
// X-Forwarded-For hop is the fallback (never the first); the socket peer when there is no proxy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { clientIp, requesterHash } from './client-ip.ts'

const req = (headers: Record<string, string | string[] | undefined>, peer?: string) => ({ headers, socket: { remoteAddress: peer } })

test('X-Real-IP wins over everything', () => {
  assert.equal(clientIp(req({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }, '127.0.0.1')), '203.0.113.7')
})

test('without X-Real-IP the LAST X-Forwarded-For hop is used, never the first', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 198.51.100.4' }, '127.0.0.1')), '198.51.100.4')
  assert.equal(clientIp(req({ 'x-forwarded-for': ' 198.51.100.4 ' }, '127.0.0.1')), '198.51.100.4')
})

test('no proxy headers → the socket peer; nothing at all → "?"', () => {
  assert.equal(clientIp(req({}, '198.51.100.9')), '198.51.100.9')
  assert.equal(clientIp(req({})), '?')
})

test('IPv4-mapped IPv6 peers and plain IPv4 hash the same (Node vs Caddy spelling)', () => {
  assert.equal(clientIp(req({}, '::ffff:198.51.100.9')), '198.51.100.9')
  assert.equal(requesterHash(req({ 'x-real-ip': '198.51.100.9' })), requesterHash(req({}, '::ffff:198.51.100.9')))
})

test('the fingerprint salt is unchanged from the original seed box (counts carry across the deploy)', () => {
  const expected = createHash('sha256').update('stakes-seed:198.51.100.9').digest('hex').slice(0, 16)
  assert.equal(requesterHash(req({ 'x-real-ip': '198.51.100.9' })), expected)
  assert.equal(expected.length, 16)
})
