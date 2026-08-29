// The on-chain payload standard (src/vault/payload.ts) — shared by the app (stamps, deposits) and
// the server (seeds, settlement tags, deposit attribution). Pure, so it's tested here with the rest.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_DATA_BYTES, buildPayload, isDepositTag, parsePayload } from '../src/vault/payload.ts'

test('builds the branded, anonymous standard', () => {
  assert.equal(buildPayload('day', 'a1b2c3d4', 1), 'stakes.day day:a1b2c3d4:1')
  assert.equal(buildPayload('official', 'a1b2c3d4'), 'stakes.day official:a1b2c3d4')
  assert.equal(buildPayload('seed', 'a1b2c3d4'), 'stakes.day seed:a1b2c3d4')
  assert.equal(buildPayload('burned', 'a1b2c3d4'), 'stakes.day burned:a1b2c3d4')
})

test('a full uuid with a 3-digit day still fits the 64-byte cap', () => {
  const p = buildPayload('day', '123e4567-e89b-12d3-a456-426614174000', 999)
  assert.ok(new TextEncoder().encode(p).length <= MAX_DATA_BYTES)
})

test('refuses anything that could leak or break the record', () => {
  assert.throws(() => buildPayload('day', 'no sugar!', 1), /payload-safe/)
  assert.throws(() => buildPayload('day', 'a1b2c3d4', 0), /day/)
  assert.throws(() => buildPayload('official', 'x'.repeat(37)), /payload-safe/)
})

test('parses the standard and the legacy Cycle-I deposit tag', () => {
  assert.deepEqual(parsePayload('stakes.day day:a1b2c3d4:7'), { verb: 'day', challengeId: 'a1b2c3d4', day: 7 })
  assert.deepEqual(parsePayload('stakes.day bonus:a1b2c3d4'), { verb: 'bonus', challengeId: 'a1b2c3d4' })
  assert.deepEqual(parsePayload('stakes:a1b2c3d4'), { verb: 'official', challengeId: 'a1b2c3d4' })
  assert.equal(parsePayload('hello'), null)
  assert.equal(parsePayload('stakes.day day:a1b2c3d4:0'), null, 'day 0 is not a human day')
})

test('deposit attribution accepts both tags, for the right challenge only', () => {
  assert.ok(isDepositTag('stakes.day official:a1b2c3d4', 'a1b2c3d4'))
  assert.ok(isDepositTag('stakes:a1b2c3d4', 'a1b2c3d4'))
  assert.ok(!isDepositTag('stakes.day official:ffffffff', 'a1b2c3d4'))
  assert.ok(!isDepositTag('stakes.day day:a1b2c3d4:1', 'a1b2c3d4'), 'a stamp is not a deposit')
})
