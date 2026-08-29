// The seed queue (server/db.ts) + the seed pass (server/seed-due.ts). All offline: injected
// throwaway key, fixed height + balance, dry runs never broadcast.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'stakes-seed-'))
process.env.STAKES_DB = join(dir, 'test.db')

const db = await import('./db.ts')
const { seedDue, TREASURY_FLOOR_LUNA } = await import('./seed-due.ts')
const { KeyPair } = await import('@nimiq/core')

after(() => rmSync(dir, { recursive: true, force: true }))

const kp = KeyPair.generate()
const nqAddr = () => KeyPair.generate().toAddress().toUserFriendlyAddress()
const challenge = () =>
  db.createChallenge({
    goal: 'run', emoji: '🏃', durationDays: 7, stake: 70, asset: 'NIM',
    creatorAddress: 'NQ00', creatorName: 'x', lockAt: Date.now(), dayLengthMs: 86400_000,
  })

test('one seed per wallet — the second request is a no-op', () => {
  const a = nqAddr()
  const id = challenge()
  assert.equal(db.requestSeed({ address: a, challengeId: id, ipHash: 'ip1', luna: 10_000 }), 'queued')
  assert.equal(db.requestSeed({ address: a, challengeId: id, ipHash: 'ip1', luna: 10_000 }), 'exists')
  assert.equal(db.getSeed(a)?.status, 'pending')
})

test('the abuse box counts by requester and overall', () => {
  const id = challenge()
  for (let i = 0; i < 3; i++) db.requestSeed({ address: nqAddr(), challengeId: id, ipHash: 'ip-abuse', luna: 1 })
  assert.equal(db.countSeedsSince(Date.now() - 60_000, 'ip-abuse'), 3)
  assert.ok(db.countSeedsSince(Date.now() - 60_000) >= 4)
})

test('dry run signs every pending seed and sends nothing', async () => {
  const before = db.listPendingSeeds().length
  const r = await seedDue({ execute: false, kp, height: 1000, balanceLuna: 10n ** 12n })
  assert.equal(r.planned, before)
  assert.equal(r.sent, 0)
  assert.equal(db.listPendingSeeds().length, before, 'still pending after a dry run')
})

test('seeding pauses at the treasury floor', async () => {
  const r = await seedDue({ execute: false, kp, height: 1000, balanceLuna: TREASURY_FLOOR_LUNA })
  assert.ok(r.skipped, 'paused with a reason')
  assert.equal(r.sent, 0)
})

test('a bad row is retried a bounded number of times, then dropped from the queue', () => {
  const id = challenge()
  const bad = 'NQ00 BAD'
  db.requestSeed({ address: bad, challengeId: id, luna: 1 })
  for (let i = 0; i < 5; i++) db.markSeedFailed(bad, 'nope')
  assert.ok(!db.listPendingSeeds().some((s) => s.address === bad), 'exhausted rows leave the queue')
  assert.equal(db.getSeed(bad)?.attempts, 5)
})

test('markSeedSent closes the row', () => {
  const a = nqAddr()
  db.requestSeed({ address: a, challengeId: challenge(), luna: 1 })
  db.markSeedSent(a, 'abc')
  assert.equal(db.getSeed(a)?.status, 'sent')
  assert.ok(!db.listPendingSeeds().some((s) => s.address === a))
})
