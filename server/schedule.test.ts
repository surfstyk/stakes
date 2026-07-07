// Tests for the shared check-in window engine (src/vault/schedule.ts) — the logic the
// server now enforces on check-ins (SEC-03). Lives here so the one `npm test` runner
// (server/*.test.ts) covers it; the module itself is shared client↔server.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayState, openDay, type Schedule } from '../src/vault/schedule.ts'

const LOCK = 1_000_000_000_000 // arbitrary fixed lockAt
const DAY = 86_400_000 // 24h
const sched = (durationDays = 7, dayLengthMs = DAY): Schedule => ({ lockAt: LOCK, durationDays, dayLengthMs })

test('before the doors close: not started, no open day', () => {
  const s = sched()
  assert.equal(openDay(s, LOCK - 1), -1)
  const ds = dayState(s, LOCK - 5000)
  assert.equal(ds.started, false)
  assert.equal(ds.msUntilStart, 5000)
})

test('day 0 opens the instant the doors close', () => {
  assert.equal(openDay(sched(), LOCK), 0)
  assert.equal(openDay(sched(), LOCK + 1), 0)
})

test('each day boundary advances the open day', () => {
  const s = sched(7)
  assert.equal(openDay(s, LOCK + DAY - 1), 0, 'last ms of day 0 is still day 0')
  assert.equal(openDay(s, LOCK + DAY), 1, 'exactly one day length in → day 1')
  assert.equal(openDay(s, LOCK + 3 * DAY + 123), 3)
  assert.equal(openDay(s, LOCK + 6 * DAY), 6, 'final day of a 7-day challenge')
})

test('after the last day: over, no open day', () => {
  const s = sched(7)
  assert.equal(openDay(s, LOCK + 7 * DAY), -1)
  assert.equal(dayState(s, LOCK + 7 * DAY).over, true)
  assert.equal(openDay(s, LOCK + 999 * DAY), -1)
})

test('respects a compressed dayLength (test-mode cadence)', () => {
  const threeMin = 3 * 60_000
  const s = sched(5, threeMin)
  assert.equal(openDay(s, LOCK + threeMin + 1), 1)
  assert.equal(openDay(s, LOCK + 5 * threeMin), -1) // over
})
