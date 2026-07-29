// Tests for the automated settlement core (server/settle-core.ts) — the money path, which
// was previously untested (AUDIT TECH-01). All offline: mock deposits auto-confirm without
// the chain, and an injected throwaway key + fixed height mean dry runs never touch a network
// and never broadcast. We assert the deterministic plan (payout + bonus + burn), due-detection,
// idempotency, and the un-payable-address skip.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Isolated temp DB — MUST be set before db.ts is imported (it opens the DB at import time).
const dir = mkdtempSync(join(tmpdir(), 'stakes-settle-'))
process.env.STAKES_DB = join(dir, 'test.db')

const db = await import('./db.ts')
const { settleChallenge } = await import('./settle-core.ts')
const { KeyPair } = await import('@nimiq/core')

after(() => rmSync(dir, { recursive: true, force: true }))

const kp = KeyPair.generate() // throwaway treasury key; dry runs never broadcast
const HEIGHT = 1_000
const nqAddr = () => KeyPair.generate().toAddress().toUserFriendlyAddress()
const MIN = 60_000

interface SeedPerson { address: string; name: string; days: number; hash?: string }
function seed(p: { durationDays: number; stake: number; lockAt: number; people: SeedPerson[] }) {
  const id = db.createChallenge({
    goal: 'run', emoji: '🏃', durationDays: p.durationDays, stake: p.stake, asset: 'NIM',
    creatorAddress: p.people[0].address, creatorName: p.people[0].name, lockAt: p.lockAt, dayLengthMs: MIN,
  })
  for (const person of p.people) {
    // mock-… deposit → auto-confirmed by verify without any chain call
    db.joinChallenge(id, { address: person.address, name: person.name, depositTxHash: person.hash ?? `mock-${person.address}` })
    for (let d = 0; d < person.days; d++) db.addCheckin(id, { address: person.address, day: d, note: 'x' })
  }
  return id
}
const ended = (durationDays: number) => Date.now() - (durationDays + 5) * MIN // run fully elapsed

test('listEndedUnsettled returns only challenges whose run has elapsed', () => {
  const a = nqAddr()
  const doneId = seed({ durationDays: 3, stake: 30, lockAt: ended(3), people: [{ address: a, name: 'A', days: 3 }] })
  const liveId = seed({ durationDays: 3, stake: 30, lockAt: Date.now(), people: [{ address: a, name: 'A', days: 0 }] })
  const due = db.listEndedUnsettled(Date.now())
  assert.ok(due.includes(doneId), 'elapsed challenge is due')
  assert.ok(!due.includes(liveId), 'still-running challenge is not due')
})

test('dry-run computes the exact payout + finisher bonus + burn plan', async () => {
  const a = nqAddr(), b = nqAddr()
  // 3-day, 30 stake (slice = 10). A perfect (retain 30 + 10 bonus = 40); B did 1 day (retain 10, forfeit 20).
  const id = seed({ durationDays: 3, stake: 30, lockAt: ended(3), people: [
    { address: a, name: 'A', days: 3 },
    { address: b, name: 'B', days: 1 },
  ] })
  const r = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  assert.equal(r.status, 'dry-run')
  const payouts = (r.planned ?? []).filter((t) => t.kind === 'payout')
  const burns = (r.planned ?? []).filter((t) => t.kind === 'burn')
  assert.equal(payouts.find((t) => t.to === a)?.nim, 40, 'perfect finisher: full stake + bonus')
  assert.equal(payouts.find((t) => t.to === b)?.nim, 10, 'partial: retained slice only')
  assert.equal(burns.length, 1)
  assert.equal(burns[0].nim, 20, 'forfeited slices are burned')
  assert.equal(r.totalOut, 70)
  assert.equal(r.burnedPot, 20)
})

test('--no-burn keeps the forfeited pot out of the plan', async () => {
  const a = nqAddr()
  const id = seed({ durationDays: 3, stake: 30, lockAt: ended(3), people: [{ address: a, name: 'A', days: 1 }] })
  const r = await settleChallenge(id, { execute: false, burn: false, kp, height: HEIGHT })
  assert.equal((r.planned ?? []).filter((t) => t.kind === 'burn').length, 0, 'no burn tx')
  assert.equal(r.burnedPot, 20, 'burnedPot is still reported for the record')
  assert.equal(r.totalOut, 10, 'only the retained payout moves')
})

test('a challenge already marked done is never re-settled', async () => {
  const a = nqAddr()
  const id = seed({ durationDays: 3, stake: 30, lockAt: ended(3), people: [{ address: a, name: 'A', days: 3 }] })
  db.startSettlement(id, '[]', 0, 0)
  db.finishSettlement(id, '[]')
  const r = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  assert.equal(r.status, 'already-settled')
  assert.ok(!db.listEndedUnsettled(Date.now()).includes(id), 'done challenges drop out of the work queue')
})

test('an un-payable (non-NQ) address is skipped, the rest still settle', async () => {
  const good = nqAddr()
  const id = seed({ durationDays: 3, stake: 30, lockAt: ended(3), people: [
    { address: good, name: 'Good', days: 3 },
    { address: 'DEV-local-tester', name: 'Dev', days: 3 },
  ] })
  const r = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  const payouts = (r.planned ?? []).filter((t) => t.kind === 'payout')
  assert.ok(payouts.some((t) => t.to === good), 'valid participant is paid')
  assert.ok(!payouts.some((t) => t.to === 'DEV-local-tester'), 'dev address is not in the plan')
  assert.equal(r.skippedParticipants?.[0]?.account, 'DEV-local-tester', 'dev address reported as skipped')
})

test('a still-running challenge is skipped unless forced', async () => {
  const a = nqAddr()
  const id = seed({ durationDays: 3, stake: 30, lockAt: Date.now(), people: [{ address: a, name: 'A', days: 1 }] })
  const skipped = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  assert.equal(skipped.status, 'skipped')
  const forced = await settleChallenge(id, { execute: false, force: true, kp, height: HEIGHT })
  assert.equal(forced.status, 'dry-run', 'force settles a still-running challenge')
})
