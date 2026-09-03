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
  // 3-day, 30 stake (slice = 10). A perfect (retain 30 + bonus 15% = 4.5, as its OWN tx); B did 1 day (retain 10, forfeit 20).
  const id = seed({ durationDays: 3, stake: 30, lockAt: ended(3), people: [
    { address: a, name: 'A', days: 3 },
    { address: b, name: 'B', days: 1 },
  ] })
  const r = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  assert.equal(r.status, 'dry-run')
  const payouts = (r.planned ?? []).filter((t) => t.kind === 'payout')
  const bonuses = (r.planned ?? []).filter((t) => t.kind === 'bonus')
  const burns = (r.planned ?? []).filter((t) => t.kind === 'burn')
  assert.equal(payouts.find((t) => t.to === a)?.nim, 30, 'perfect finisher: full stake back')
  assert.equal(bonuses.find((t) => t.to === a)?.nim, 4.5, 'perfect finisher: the bonus is its own tx (15% of 30)')
  assert.equal(payouts.find((t) => t.to === b)?.nim, 10, 'partial: retained slice only')
  assert.ok(!bonuses.some((t) => t.to === b), 'no bonus for a partial run')
  assert.equal(burns.length, 1)
  assert.equal(burns[0].nim, 20, 'forfeited slices are burned')
  assert.equal(r.totalOut, 64.5)
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

test('a run every participant kept in full settles now, before the clock runs out (J9)', async () => {
  const a = nqAddr()
  const id = seed({ durationDays: 3, stake: 30, lockAt: Date.now(), people: [{ address: a, name: 'A', days: 3 }] })
  assert.ok(db.listEndedUnsettled(Date.now()).includes(id), 'a decided run is in the work queue')
  const r = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  assert.equal(r.status, 'dry-run', 'settles without --force')
  assert.equal((r.planned ?? []).filter((t) => t.kind === 'bonus').length, 1)
})

test('a run nobody ever staked is closed empty once it has elapsed, and leaves the queue', async () => {
  const id = db.createChallenge({
    goal: 'window', emoji: '🍩', durationDays: 1, stake: 70, asset: 'NIM',
    creatorAddress: nqAddr(), creatorName: 'W', lockAt: ended(1), dayLengthMs: MIN,
  })
  assert.ok(db.listEndedUnsettled(Date.now()).includes(id))
  const r = await settleChallenge(id, { execute: true, kp, height: HEIGHT })
  assert.equal(r.status, 'skipped')
  assert.match(r.reason ?? '', /closed empty/)
  assert.equal(db.getSettlementRecord(id)?.status, 'done')
  assert.ok(!db.listEndedUnsettled(Date.now()).includes(id), 'no longer rescanned')
})

test('a dry run over an elapsed empty run reports the close but persists nothing', async () => {
  const id = db.createChallenge({
    goal: 'window', emoji: '🍩', durationDays: 1, stake: 70, asset: 'NIM',
    creatorAddress: nqAddr(), creatorName: 'W', lockAt: ended(1), dayLengthMs: MIN,
  })
  const r = await settleChallenge(id, { execute: false, kp, height: HEIGHT })
  assert.equal(r.status, 'skipped')
  assert.match(r.reason ?? '', /closed empty/)
  assert.equal(db.getSettlementRecord(id), undefined, 'dry run wrote no settlement record')
  assert.ok(db.listEndedUnsettled(Date.now()).includes(id), 'still queued for a real settle')
})

test('the bonus policy is a capped share of the stake, never a flat amount', async () => {
  const { finisherBonus } = await import('../src/vault/settlement.ts')
  assert.equal(finisherBonus(30), 4.5)
  assert.equal(finisherBonus(1), 0.15)
  assert.equal(finisherBonus(10_000), 50, 'capped')
  assert.equal(finisherBonus(0), 0)
})

// ---- audit H1: the bonus guard — one bonus per wallet per cooldown + a global daily budget ----

test('H1: a wallet that just banked a bonus gets none on an immediate back-to-back run (cooldown)', async () => {
  const a = nqAddr()
  const first = seed({ durationDays: 1, stake: 334, lockAt: Date.now(), people: [{ address: a, name: 'A', days: 1 }] })
  const r1 = await settleChallenge(first, { execute: false, kp, height: HEIGHT })
  assert.equal((r1.planned ?? []).find((t) => t.kind === 'bonus')?.nim, 50, 'first run: bonus (capped at 50)')
  // commit that plan as if broadcast (the ledger the guard reads)
  db.startSettlement(first, JSON.stringify(r1.planned), 0, r1.totalOut ?? 0)
  db.finishSettlement(first, JSON.stringify(r1.planned))
  const second = seed({ durationDays: 1, stake: 334, lockAt: Date.now(), people: [{ address: a, name: 'A', days: 1 }] })
  const r2 = await settleChallenge(second, { execute: false, kp, height: HEIGHT })
  assert.equal(r2.status, 'dry-run')
  assert.equal((r2.planned ?? []).find((t) => t.kind === 'payout')?.nim, 334, 'the stake is still returned in full')
  assert.ok(!(r2.planned ?? []).some((t) => t.kind === 'bonus'), 'no second bonus inside the cooldown')
})

test('H1: the global daily bonus budget caps what all wallets together can extract', async () => {
  const prev = process.env.STAKES_BONUS_DAILY_CAP_NIM
  // the ledger is shared with the tests above: budget = what is already spent today + room for ONE bonus
  const spent = db.listBonusesSince(Date.now() - 86400_000).reduce((s, b) => s + b.nim, 0)
  process.env.STAKES_BONUS_DAILY_CAP_NIM = String(spent + 60)
  try {
    const a = nqAddr(), b = nqAddr()
    const one = seed({ durationDays: 1, stake: 334, lockAt: Date.now(), people: [{ address: a, name: 'A', days: 1 }] })
    const r1 = await settleChallenge(one, { execute: false, kp, height: HEIGHT })
    assert.equal((r1.planned ?? []).find((t) => t.kind === 'bonus')?.nim, 50)
    db.startSettlement(one, JSON.stringify(r1.planned), 0, r1.totalOut ?? 0)
    db.finishSettlement(one, JSON.stringify(r1.planned))
    const two = seed({ durationDays: 1, stake: 334, lockAt: Date.now(), people: [{ address: b, name: 'B', days: 1 }] })
    const r2 = await settleChallenge(two, { execute: false, kp, height: HEIGHT })
    assert.ok(!(r2.planned ?? []).some((t) => t.kind === 'bonus'), 'budget (room for one) exhausted by the first 50 → a second 50 is withheld')
    assert.equal((r2.planned ?? []).find((t) => t.kind === 'payout')?.nim, 334, 'principal untouched')
  } finally {
    if (prev === undefined) delete process.env.STAKES_BONUS_DAILY_CAP_NIM
    else process.env.STAKES_BONUS_DAILY_CAP_NIM = prev
  }
})

test('H1: applyBonusGuard is pure and deterministic', async () => {
  const { applyBonusGuard } = await import('./settle-core.ts')
  const now = 1_000_000_000_000
  const rows = [{ account: 'X', nimBonus: 10 }, { account: 'Y', nimBonus: 10 }, { account: 'Z', nimBonus: 0 }]
  const ledger = [{ to: 'x', nim: 5, at: now - 60_000 }] // same wallet, different case, 1 min ago
  const out = applyBonusGuard(rows, ledger, now)
  assert.deepEqual(out.map((o) => [o.account, o.nimBonus, o.withheld ?? null]), [['X', 0, 'cooldown'], ['Y', 10, null], ['Z', 0, null]])
})

// ---- audit M2: a taste (durationDays = 0) never enters the settler queue ----

test('M2: a fresh taste (durationDays 0) is NOT on the settler queue', () => {
  const id = db.createChallenge({
    goal: 'taste', emoji: '🍩', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: nqAddr(), creatorName: 'T', lockAt: Date.now() - 3 * 86400_000, dayLengthMs: 86400_000, status: 'window',
  })
  assert.ok(!db.listEndedUnsettled(Date.now()).includes(id), 'nothing to settle, nothing to rescan')
})
