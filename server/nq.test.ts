// Nimiq address checksum (server/nq.ts) — must agree with @nimiq/core for every generated address.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidNq, normNq, prettyNq } from './nq.ts'
import { KeyPair } from '@nimiq/core'

const TREASURY = 'NQ83 0UJS 7NG3 QH7K 3VLF 7E06 JNH4 X5EV U04R'
const STAMP = 'NQ25 V9U3 BPTD S9T9 DM5P DHGM CY59 U2B4 7D59'
const BURN = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

test('known-good addresses validate (treasury, stamp feed, burn)', () => {
  for (const a of [TREASURY, STAMP, BURN]) assert.ok(isValidNq(a), a)
})

test('agrees with @nimiq/core on 50 freshly generated addresses', () => {
  for (let i = 0; i < 50; i++) {
    const a = KeyPair.generate().toAddress().toUserFriendlyAddress()
    assert.ok(isValidNq(a), a)
    assert.ok(isValidNq(a.toLowerCase()), 'case-insensitive')
    assert.ok(isValidNq(normNq(a)), 'spacing-insensitive')
  }
})

test('a single corrupted character fails the checksum', () => {
  const a = normNq(TREASURY)
  const flipped = a.slice(0, 10) + (a[10] === 'A' ? 'B' : 'A') + a.slice(11)
  assert.equal(isValidNq(flipped), false)
  const badCheck = 'NQ84' + a.slice(4)
  assert.equal(isValidNq(badCheck), false)
})

test('shape failures: wrong length, wrong prefix, forbidden base32 letters, DEV- identities', () => {
  assert.equal(isValidNq('NQ83 0UJS'), false)
  assert.equal(isValidNq('XQ83 0UJS 7NG3 QH7K 3VLF 7E06 JNH4 X5EV U04R'), false)
  assert.equal(isValidNq('NQ83 0UJS 7NG3 QH7K 3VLF 7E06 JNH4 X5EV U04I'), false) // I is not base32 here
  assert.equal(isValidNq('DEV-ABCDEF123456'), false)
  assert.equal(isValidNq(''), false)
})

test('prettyNq groups in fours', () => {
  assert.equal(prettyNq(normNq(TREASURY)), TREASURY)
})
