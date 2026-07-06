// Unit tests for the deposit-attribution core (server/attribute.ts) — the fix for SEC-01
// (one on-chain deposit confirming two participants → phantom payouts).
//
//   npm test
//
// No DB / no chain: attributeDeposits is a pure function, so these run instantly.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attributeDeposits } from './attribute.ts'

const STAKE = 3_500_000 // 35 NIM in luna
const dep = (from: string, hash: string, valueLuna = STAKE) => ({ from, valueLuna, hash })

test('honest run: each participant matched to their own deposit, deposits consumed once', () => {
  const parts = [
    { address: 'NQ_ALICE', depositTxHash: 'hA' },
    { address: 'NQ_BOB', depositTxHash: 'hB' },
  ]
  const deposits = [dep('NQ_ALICE', 'hA'), dep('NQ_BOB', 'hB')]
  const r = attributeDeposits(parts, deposits, STAKE)
  assert.deepEqual(
    r.map((m) => [m.address, m.confirmed, m.hash]),
    [
      ['NQ_ALICE', true, 'hA'],
      ['NQ_BOB', true, 'hB'],
    ],
  )
})

test('SEC-01: a stolen hash cannot double-confirm one deposit (victim joined first)', () => {
  // Only Alice really deposited. Mallory reports Alice's public tx hash but sent nothing.
  const parts = [
    { address: 'NQ_ALICE', depositTxHash: 'hA' }, // real depositor, sender == identity
    { address: 'NQ_MALLORY', depositTxHash: 'hA' }, // claims Alice's hash, no deposit
  ]
  const deposits = [dep('NQ_ALICE', 'hA')]
  const r = attributeDeposits(parts, deposits, STAKE)
  const byAddr = Object.fromEntries(r.map((m) => [m.address, m]))
  assert.equal(byAddr['NQ_ALICE'].confirmed, true, 'the real depositor is confirmed')
  assert.equal(byAddr['NQ_MALLORY'].confirmed, false, 'the hash thief is NOT confirmed')
  assert.equal(r.filter((m) => m.confirmed).length, 1, 'exactly one confirmation for one deposit')
})

test('SEC-01: sender-match runs first, so ordering cannot let a hash thief steal the slot', () => {
  // Same attack but Mallory is processed first (joined earlier). Pass 1 still gives Alice
  // her deposit by sender before Mallory's hash fallback can claim it.
  const parts = [
    { address: 'NQ_MALLORY', depositTxHash: 'hA' },
    { address: 'NQ_ALICE', depositTxHash: 'hA' },
  ]
  const deposits = [dep('NQ_ALICE', 'hA')]
  const byAddr = Object.fromEntries(attributeDeposits(parts, deposits, STAKE).map((m) => [m.address, m]))
  assert.equal(byAddr['NQ_ALICE'].confirmed, true)
  assert.equal(byAddr['NQ_MALLORY'].confirmed, false)
})

test('sub-address wallet: confirmed via reported hash when sender != identity', () => {
  // Real Nimiq Pay wallets can send from a sub-address that differs from listAccounts().
  const parts = [{ address: 'NQ_IDENTITY', depositTxHash: 'hX' }]
  const deposits = [dep('NQ_SUBADDRESS', 'hX')]
  const r = attributeDeposits(parts, deposits, STAKE)
  assert.equal(r[0].confirmed, true)
  assert.equal(r[0].hash, 'hX')
  assert.equal(r[0].valueLuna, STAKE)
})

test('address casing/spacing is normalized for the sender match', () => {
  const parts = [{ address: 'nq alice', depositTxHash: null }]
  const deposits = [dep('NQ ALICE', 'hA')]
  assert.equal(attributeDeposits(parts, deposits, STAKE)[0].confirmed, true)
})

test('fewer deposits than participants: only real deposits confirm', () => {
  const parts = [
    { address: 'NQ_A', depositTxHash: 'hA' },
    { address: 'NQ_B', depositTxHash: 'hB' },
    { address: 'NQ_C', depositTxHash: 'hC' }, // never deposited
  ]
  const deposits = [dep('NQ_A', 'hA'), dep('NQ_B', 'hB')]
  const r = attributeDeposits(parts, deposits, STAKE)
  assert.equal(r.filter((m) => m.confirmed).length, 2)
  assert.equal(r.find((m) => m.address === 'NQ_C')!.confirmed, false)
})

test('wrong-value deposit is not matched (beyond the 1-luna rounding tolerance)', () => {
  const parts = [{ address: 'NQ_A', depositTxHash: 'hA' }]
  const deposits = [dep('NQ_A', 'hA', STAKE - 100)] // underpaid
  assert.equal(attributeDeposits(parts, deposits, STAKE)[0].confirmed, false)
})

test('1-luna rounding difference is tolerated', () => {
  const parts = [{ address: 'NQ_A', depositTxHash: 'hA' }]
  const deposits = [dep('NQ_A', 'hA', STAKE - 1)]
  assert.equal(attributeDeposits(parts, deposits, STAKE)[0].confirmed, true)
})
