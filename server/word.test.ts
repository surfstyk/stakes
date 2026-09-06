// The commitment-mirror queue (server/db.ts `word_stamps`) + the mirror pass (server/word-due.ts).
// All offline: injected throwaway key, fixed height + balance, dry runs never broadcast.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'stakes-word-'))
process.env.STAKES_DB = join(dir, 'test.db')

const db = await import('./db.ts')
const { wordDue } = await import('./word-due.ts')
const { KeyPair } = await import('@nimiq/core')

after(() => rmSync(dir, { recursive: true, force: true }))

const kp = KeyPair.generate()
const STAMP = KeyPair.generate().toAddress().toUserFriendlyAddress()
const challenge = (stake = 300) =>
  db.createChallenge({
    goal: 'run', emoji: '🏃', durationDays: 7, stake, asset: 'NIM',
    creatorAddress: 'NQ00', creatorName: 'x', lockAt: Date.now(), dayLengthMs: 86400_000,
  })

test('one commitment stamp per challenge — a repeat is a no-op', () => {
  const id = challenge()
  assert.equal(db.requestWordStamp({ challengeId: id, nim: 300 }), 'queued')
  assert.equal(db.requestWordStamp({ challengeId: id, nim: 300 }), 'exists')
  assert.equal(db.getWordStamp(id)?.status, 'pending')
  assert.equal(db.getWordStamp(id)?.nim, 300)
})

test('dry run signs every pending commitment stamp and sends nothing', async () => {
  process.env.STAKES_STAMP_ADDRESS = STAMP
  const before = db.listPendingWordStamps().length
  const r = await wordDue({ execute: false, kp, height: 1000, balanceLuna: 10n ** 12n })
  assert.equal(r.planned, before)
  assert.equal(r.sent, 0)
  assert.equal(db.listPendingWordStamps().length, before, 'still pending after a dry run')
})

test('with no stamp address configured, the pass pauses and sends nothing', async () => {
  delete process.env.STAKES_STAMP_ADDRESS
  db.requestWordStamp({ challengeId: challenge(), nim: 50 })
  const r = await wordDue({ execute: true, kp, height: 1000, balanceLuna: 10n ** 12n })
  assert.ok(r.skipped, 'paused with a reason')
  assert.equal(r.sent, 0)
})
