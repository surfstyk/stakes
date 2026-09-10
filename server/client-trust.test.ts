// The client-trust boxes over HTTP (AUDIT-CYCLE-II.md §9): the seed lanes keyed on the proxy-set
// X-Real-IP, the creation box, the address checksum on real money, and the identity tripwire.
// Offline: temp DB, random loopback port; a treasury is configured so realMoney() paths run, but
// nothing here reaches /official (no chain).
import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

const dir = mkdtempSync(join(tmpdir(), 'stakes-trust-'))
process.env.STAKES_DB = join(dir, 'test.db')
process.env.STAKES_API_PORT = '0'
process.env.STAKES_TREASURY_ADDRESS = 'NQ83 0UJS 7NG3 QH7K 3VLF 7E06 JNH4 X5EV U04R'
process.env.STAKES_SEED_HOURLY_CAP = '100000'
process.env.STAKES_SEED_REPEAT_POOL = '100000'
process.env.STAKES_SEED_DAILY_CAP = '100000'

const db = await import('./db.ts')
const { server } = await import('./api.ts')
const { requesterHash } = await import('./client-ip.ts')
const { KeyPair } = await import('@nimiq/core')

let base = ''
before(async () => {
  if (!server.listening) await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => {
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

const nqAddr = () => KeyPair.generate().toAddress().toUserFriendlyAddress()
const j = async (method: string, path: string, body?: unknown, ip = '198.51.100.1', extra: Record<string, string> = {}) => {
  const res = await fetch(base + '/api' + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-real-ip': ip, ...extra },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : undefined }
}
const DAY = 86_400_000
const taste = (ip: string, creatorAddress = nqAddr()) => j('POST', '/challenges', { templateId: 'run', goal: 'run', emoji: '🏃', creatorAddress }, ip)

test('real money: a taste needs a checksum-valid Nimiq address, not just a string', async () => {
  assert.equal((await j('POST', '/challenges', { goal: 'x', creatorAddress: 'DEV-ABCDEF123456' })).status, 400)
  assert.equal((await j('POST', '/challenges', { goal: 'x', creatorAddress: 'NQ84 0UJS 7NG3 QH7K 3VLF 7E06 JNH4 X5EV U04R' })).status, 400)
  assert.equal((await taste('198.51.100.1')).status, 201)
})

test('the public view never carries the creator fingerprint', async () => {
  const { body } = await taste('198.51.100.2')
  assert.ok(!('creatorFp' in body), 'reshape view')
  const full = await j('GET', `/challenges/${body.id}`)
  assert.equal(full.status, 200)
  assert.ok(!('creatorFp' in full.body), 'public challenge view')
  assert.equal(db.getChallengeRow(body.id)?.creatorFp, requesterHash({ headers: { 'x-real-ip': '198.51.100.2' } }))
})

test('the seed fingerprint follows X-Real-IP, not X-Forwarded-For', async () => {
  const { body } = await taste('198.51.100.3')
  const addr = nqAddr()
  const r = await j('POST', '/seed', { address: addr, challengeId: body.id }, '198.51.100.3', { 'x-forwarded-for': '9.9.9.9' })
  assert.equal(r.status, 200)
  assert.equal(db.getSeed(addr, body.id)?.ipHash, requesterHash({ headers: { 'x-real-ip': '198.51.100.3' } }))
})

test('a corrupted address is refused before it consumes a seed slot', async () => {
  const { body } = await taste('198.51.100.4')
  const r = await j('POST', '/seed', { address: 'NQ84 0UJS 7NG3 QH7K 3VLF 7E06 JNH4 X5EV U04R', challengeId: body.id }, '198.51.100.4')
  assert.equal(r.status, 400)
})

test('seed lanes: per-IP cap, then the repeat pool closes to repeats but newcomers still pass, then the hourly ceiling', async () => {
  const ids: string[] = []
  for (let i = 0; i < 6; i++) ids.push((await taste('198.51.100.5')).body.id)
  process.env.STAKES_SEED_PER_IP_DAILY = '2'
  const A = '203.0.113.10'
  assert.equal((await j('POST', '/seed', { address: nqAddr(), challengeId: ids[0] }, A)).status, 200, 'newcomer')
  assert.equal((await j('POST', '/seed', { address: nqAddr(), challengeId: ids[1] }, A)).status, 200, 'repeat under the per-IP cap')
  const r3 = await j('POST', '/seed', { address: nqAddr(), challengeId: ids[2] }, A)
  assert.equal(r3.status, 429)
  assert.equal(r3.body.error, 'too many seeds from this network today')
  // close the repeat pool at the current total: repeats stop, a brand-new network still gets one
  process.env.STAKES_SEED_REPEAT_POOL = String(db.countSeedsSince(Date.now() - DAY))
  const B = '203.0.113.11'
  assert.equal((await j('POST', '/seed', { address: nqAddr(), challengeId: ids[3] }, B)).status, 200, 'newcomer passes with the pool closed')
  const rB2 = await j('POST', '/seed', { address: nqAddr(), challengeId: ids[4] }, B)
  assert.equal(rB2.status, 429)
  assert.equal(rB2.body.error, 'seed cap reached for repeat requests today')
  // the hourly ceiling stops everyone
  process.env.STAKES_SEED_HOURLY_CAP = String(db.countSeedsSince(Date.now() - 3_600_000))
  const rC = await j('POST', '/seed', { address: nqAddr(), challengeId: ids[5] }, '203.0.113.12')
  assert.equal(rC.status, 429)
  assert.equal(rC.body.error, 'seed cap reached for this hour')
  process.env.STAKES_SEED_HOURLY_CAP = '100000'
  process.env.STAKES_SEED_REPEAT_POOL = '100000'
  process.env.STAKES_SEED_PER_IP_DAILY = '20'
})

test('the creation box bounds junk rows per network; other networks are unaffected', async () => {
  process.env.STAKES_CREATE_PER_IP_DAILY = '3'
  const ip = '203.0.113.20'
  for (let i = 0; i < 3; i++) assert.equal((await taste(ip)).status, 201)
  const r = await taste(ip)
  assert.equal(r.status, 429)
  assert.equal(r.body.error, 'too many new challenges from this network today')
  assert.equal((await taste('203.0.113.21')).status, 201)
  process.env.STAKES_CREATE_PER_IP_DAILY = '100'
})

test('tripwire: a taste replaced or deleted from a different network than its creator is logged, never blocked', async () => {
  const victim = nqAddr()
  const before = db.countSecurityEventsSince(0)
  const first = await taste('203.0.113.30', victim)
  assert.equal(first.status, 201)
  // same network re-taps the deck → replaced silently, no event
  const same = await taste('203.0.113.30', victim)
  assert.equal(same.status, 201)
  assert.equal(db.countSecurityEventsSince(0), before)
  // another network "starts a challenge as" the victim → still replaced (by design), but logged
  const foreign = await taste('203.0.113.31', victim)
  assert.equal(foreign.status, 201)
  assert.equal(db.countSecurityEventsSince(0, ['taste-replaced-foreign']), 1)
  // and a delete by id from yet another network
  const del = await j('DELETE', `/challenges/${foreign.body.id}`, undefined, '203.0.113.32')
  assert.equal(del.body.deleted, true)
  assert.equal(db.countSecurityEventsSince(0, ['taste-deleted-foreign']), 1)
  // the owner deleting their own taste is not an event
  const own = await taste('203.0.113.33', nqAddr())
  await j('DELETE', `/challenges/${own.body.id}`, undefined, '203.0.113.33')
  assert.equal(db.countSecurityEventsSince(0), before + 2)
})
