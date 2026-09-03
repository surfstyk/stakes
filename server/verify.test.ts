// Deposit-verification security (server/verify.ts) — the fix for the pre-submission audit's
// CRITICAL finding: on a REAL-MONEY deployment a participant with no on-chain deposit (null hash,
// or a `mock-…` ref) must NEVER be auto-confirmed, or they could be paid a stake they never
// deposited (treasury drain). A mock/dev build (no treasury) keeps auto-confirming so the whole
// loop still runs in a plain browser.
//
// All offline: an isolated temp DB, no chain. The one participant here has no on-chain hash, so
// verify never performs an RPC lookup (onChain stays false).

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'stakes-verify-'))
process.env.STAKES_DB = join(dir, 'test.db')

const db = await import('./db.ts')
const { verifyChallenge } = await import('./verify.ts')

after(() => rmSync(dir, { recursive: true, force: true }))

// A valid-format NQ treasury address is enough to flip verify into real-money mode; the on-chain
// lookup is never reached (the sole participant has no on-chain hash), so no network is touched.
const TREASURY = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

/** Create an official (staked) run with one participant whose deposit hash is `hash`. */
function officialRun(creator: string, hash: string | undefined): string {
  const id = db.createChallenge({
    goal: 'run', emoji: '🏃', durationDays: 1, stake: 10_000, asset: 'NIM',
    creatorAddress: creator, creatorName: 'You', lockAt: Date.now(), dayLengthMs: 86400_000, status: 'window',
  })
  db.setOfficial(id, { durationDays: 1, stake: 10_000, stakedAt: Date.now() })
  db.joinChallenge(id, { address: creator, name: 'You', depositTxHash: hash })
  return id
}

async function withTreasury<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.STAKES_TREASURY_ADDRESS
  process.env.STAKES_TREASURY_ADDRESS = TREASURY
  try {
    return await fn()
  } finally {
    if (prev === undefined) delete process.env.STAKES_TREASURY_ADDRESS
    else process.env.STAKES_TREASURY_ADDRESS = prev
  }
}

test('real-money: a participant with NO deposit hash is NOT confirmed (no phantom stake)', async () => {
  const id = officialRun('NQ_ATTACKER_1', undefined)
  const r = await withTreasury(() => verifyChallenge(id))
  assert.equal(r?.confirmed, 0, 'nothing confirmed against real funds without an on-chain deposit')
  assert.equal(r?.confirmedLuna, 0, 'no phantom value counted toward the settlement invariant')
  const p = db.getChallenge(id)!.participants[0]
  assert.equal(p.depositConfirmed, 0, 'the participant stays unconfirmed')
  // → getSettlement pays this run nothing, because it settles confirmed deposits only.
  assert.equal(db.getSettlement(id)!.perParticipant.length, 0, 'a run with no confirmed deposit settles nobody')
})

test('real-money: a forged `mock-` hash is NOT auto-confirmed either', async () => {
  const id = officialRun('NQ_ATTACKER_2', 'mock-forged')
  const r = await withTreasury(() => verifyChallenge(id))
  assert.equal(r?.confirmed, 0, 'a `mock-` ref is not proof of an on-chain deposit')
  assert.equal(db.getChallenge(id)!.participants[0].depositConfirmed, 0)
})

test('mock/dev (no treasury): a null-hash deposit still auto-confirms so the browser loop runs', async () => {
  const prev = process.env.STAKES_TREASURY_ADDRESS
  delete process.env.STAKES_TREASURY_ADDRESS // ensure mock mode
  const id = officialRun('NQ_DEV_1', undefined)
  const r = await verifyChallenge(id)
  if (prev !== undefined) process.env.STAKES_TREASURY_ADDRESS = prev
  assert.equal(r?.confirmed, 1, 'mock build (no treasury) keeps the loop clickable')
  assert.equal(db.getChallenge(id)!.participants[0].depositConfirmed, 1)
})
