// The sphere is rendered on every commit/day screen, so pickLine must be TOTAL — a throw or an
// undefined line here blanks the whole app (the "Make it official" screen showed nothing in the
// 2026-09-11 user report). These lock that guarantee: whatever the inputs, a line comes back.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickLine, type Moment } from './sphere.ts'

const ok = (p: { text: string; source: string | null }) => {
  assert.equal(typeof p.text, 'string')
  assert.ok(p.text.length > 0, 'a non-empty line')
  assert.ok(p.source === null || typeof p.source === 'string')
}

test('pickLine returns a real line for a known template', () => {
  ok(pickLine('run', 0, 1))
  ok(pickLine('sugar', 2, 5, 'win'))
  ok(pickLine('cold', 4, 3, 'slip'))
})

test('pickLine never throws on an unknown or empty template', () => {
  ok(pickLine('does-not-exist', 0, 0))
  ok(pickLine('', 0, 0))
})

test('pickLine coerces non-finite inputs instead of indexing with NaN', () => {
  // A challenge with a bad clock makes currentDay() NaN; the sphere must still speak.
  ok(pickLine('run', NaN, 1))
  ok(pickLine('run', 0, NaN))
  ok(pickLine('run', Infinity, -Infinity))
  ok(pickLine('run', -5, -9))
})

test('pickLine is deterministic in (dayIndex, tap)', () => {
  assert.deepEqual(pickLine('run', 3, 2), pickLine('run', 3, 2))
})

test('a plain tap never surfaces a context-only (win/slip) moment', () => {
  // Exhaustively sample the plain-tap pool; none of it may be win/slip flavour.
  for (const m of [undefined, 'crave', 'start', 'grind', 'doubt', 'tired', 'any'] as (Moment | undefined)[]) {
    for (let d = 0; d < 30; d++) for (let t = 0; t < 7; t++) ok(pickLine('run', d, t, m))
  }
})
