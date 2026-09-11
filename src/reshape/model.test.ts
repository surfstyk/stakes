// The day-clock is the app's most-broken surface: the 2026-09-11 desync/blank-screen fixes
// (546d45e, ddaf06d) and the rolled-over-day fix (d4fe847) all lived in these derivations, and
// they had NO regression net. These lock the behaviours a judge will exercise by hand and the
// laws we've committed to — the no-cancel/lapse law, the rolled-over day reading fresh, a perfect
// run banking the instant its last day seals. Every function is pure (challenge, now)→value, so
// no DOM or mocks: we drive `now` across the boundaries that matter.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLapsed,
  isRunOver,
  effectiveStatus,
  isTerminal,
  hasFreshMiss,
  currentDay,
  dayFill,
  isCheckedToday,
  canCheckInToday,
  dayCloseInfo,
  weekView,
  chainSoFar,
  streak,
  outcomeOf,
  payoffOf,
  goalRecord,
  type Challenge,
  type CheckIn,
  type HistoryItem,
} from './model.ts'

const LOCK = 1_700_000_000_000 // fixed lockAt (the free-tap moment, day 0 start)
const DAY = 86_400_000 // 24h

/** An official, staked run by default; override for a taste (`window`) or any field. */
function mk(o: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    templateId: 'run',
    goal: 'Run',
    emoji: '🏃',
    status: 'official',
    creatorAddress: 'NQ00 TEST',
    createdAt: LOCK,
    lockAt: LOCK,
    dayLengthMs: DAY,
    durationDays: 7,
    stake: 70,
    asset: 'NIM',
    stakedAt: LOCK,
    checkins: [],
    seq: 1,
    ...o,
  }
}

/** Check-ins for the given day indices, each stamped inside its own day window. */
const days = (...ds: number[]): CheckIn[] => ds.map((d) => ({ day: d, at: LOCK + d * DAY + 1000 }))

// A taste = the 24h window, not yet staked (durationDays 0, one clock = day 0 itself).
const taste = (o: Partial<Challenge> = {}) => mk({ status: 'window', durationDays: 0, stakedAt: null, ...o })

// ---- the no-cancel / lapse law ---------------------------------------------------------------
// A started taste has exactly one way to "step back": let the 24h clock run out. There is no
// cancel path in the model — before the window closes it is live; at/after it, it lapses.

test('a taste is live for its 24h and then lapses — the only way back is the clock (no-cancel law)', () => {
  const ch = taste()
  assert.equal(isLapsed(ch, LOCK), false, 'day 0 just started')
  assert.equal(isLapsed(ch, LOCK + DAY - 1), false, 'last ms of the window is still live')
  assert.equal(isLapsed(ch, LOCK + DAY), true, 'exactly 24h in → lapsed')
  assert.equal(effectiveStatus(ch, LOCK + DAY - 1), 'window')
  assert.equal(effectiveStatus(ch, LOCK + DAY), 'lapsed')
})

test('a staked run never lapses — staking is forward-only', () => {
  const ch = taste({ status: 'official', durationDays: 3, stakedAt: LOCK + 1000 })
  assert.equal(isLapsed(ch, LOCK + 99 * DAY), false, 'isLapsed only fires on an un-staked window')
})

// ---- the rolled-over day reads as a fresh, checkable day (d4fe847) ----------------------------

test('a day that rolled over reads as a fresh, un-checked, checkable day', () => {
  const ch = mk({ durationDays: 7, checkins: days(0) }) // kept day 0, now in day 1
  const now = LOCK + DAY + 3600_000 // 1h into day 1
  assert.equal(currentDay(ch, now), 1, 'the open day advanced')
  assert.equal(isCheckedToday(ch, now), false, 'yesterday’s check-in does not count for today')
  assert.equal(canCheckInToday(ch, now), true, 'the fresh day is checkable again')
})

test('a perfect run banks the instant its last day seals, and stays banked (shareable)', () => {
  const ch = mk({ durationDays: 3, checkins: days(0, 1, 2) })
  const midDay2 = LOCK + 2 * DAY + 3600_000 // still inside day 2, but all 3 already kept
  assert.equal(isRunOver(ch, midDay2), true, 'allKept ends the run before the clock does')
  assert.equal(effectiveStatus(ch, midDay2), 'ended')
  assert.equal(isRunOver(ch, LOCK + 999 * DAY), true, 'and it stays over later')
})

test('a run that is not yet complete and not yet elapsed is still official', () => {
  const ch = mk({ durationDays: 3, checkins: days(0) })
  assert.equal(isRunOver(ch, LOCK + DAY + 1000), false)
  assert.equal(effectiveStatus(ch, LOCK + DAY + 1000), 'official')
})

test('a run whose clock elapsed is over even with days missed', () => {
  const ch = mk({ durationDays: 3, checkins: days(0) })
  assert.equal(isRunOver(ch, LOCK + 3 * DAY), true, 'time is up')
  assert.equal(effectiveStatus(ch, LOCK + 3 * DAY), 'ended')
})

// ---- effectiveStatus / isTerminal passthrough ------------------------------------------------

test('effectiveStatus passes through already-settled/lapsed states unchanged', () => {
  assert.equal(effectiveStatus(mk({ status: 'settled' }), LOCK), 'settled')
  assert.equal(effectiveStatus(mk({ status: 'lapsed' }), LOCK), 'lapsed')
  assert.equal(isTerminal(mk({ status: 'settled' }), LOCK), true)
  assert.equal(isTerminal(mk({ durationDays: 3, checkins: days(0, 1, 2) }), LOCK + 2 * DAY + 1), true)
  assert.equal(isTerminal(mk({ durationDays: 3, checkins: days(0) }), LOCK + DAY + 1), false)
})

// ---- currentDay / dayFill --------------------------------------------------------------------

test('currentDay tracks the open day and clamps to durationDays once over', () => {
  const ch = mk({ durationDays: 7 })
  assert.equal(currentDay(ch, LOCK), 0)
  assert.equal(currentDay(ch, LOCK + DAY - 1), 0, 'last ms of day 0')
  assert.equal(currentDay(ch, LOCK + 3 * DAY + 5), 3)
  assert.equal(currentDay(ch, LOCK + 99 * DAY), 7, 'clamped to durationDays when over')
})

test('dayFill is the elapsed fraction of the current day (a taste fills as day 0)', () => {
  const t = taste()
  assert.equal(dayFill(t, LOCK), 0)
  assert.equal(dayFill(t, LOCK + DAY / 2), 0.5)
  assert.equal(dayFill(t, LOCK + DAY), 1, 'the window is full at 24h')
  const ch = mk({ durationDays: 7 })
  assert.equal(dayFill(ch, LOCK + 2 * DAY + DAY / 4), 0.25, 'resets each day')
})

// ---- check-in gating -------------------------------------------------------------------------

test('canCheckInToday only inside an official open day that is not already sealed', () => {
  const ch = mk({ durationDays: 3 })
  assert.equal(canCheckInToday(ch, LOCK + 1000), true, 'day 0 open, unsealed')
  assert.equal(canCheckInToday(mk({ durationDays: 3, checkins: days(0) }), LOCK + 1000), false, 'already sealed today')
  assert.equal(canCheckInToday(ch, LOCK + 3 * DAY), false, 'run is over')
  assert.equal(canCheckInToday(taste(), LOCK + 1000), false, 'a taste is not an official day')
})

// ---- dayCloseInfo ----------------------------------------------------------------------------

test('dayCloseInfo names the real 24h close and never reports negative time left', () => {
  const ch = mk({ durationDays: 7 })
  const info = dayCloseInfo(ch, LOCK + 3600_000) // 1h into day 0
  assert.equal(info.closeAt, LOCK + DAY, 'day 0 closes one day-length after lockAt')
  assert.equal(info.hoursLeft, 23)
  const past = dayCloseInfo(mk({ durationDays: 1 }), LOCK + 99 * DAY)
  assert.ok(past.hoursLeft >= 0, 'clamped at 0, never negative')
})

// ---- fresh miss ------------------------------------------------------------------------------

test('hasFreshMiss fires when the previous day went unsealed and today is unsealed', () => {
  const missed = mk({ durationDays: 7, checkins: days(0) }) // missed day 1, now in day 2
  assert.equal(hasFreshMiss(missed, LOCK + 2 * DAY + 1000), true)
  const kept = mk({ durationDays: 7, checkins: days(0, 1) }) // day 1 was sealed
  assert.equal(hasFreshMiss(kept, LOCK + 2 * DAY + 1000), false)
  assert.equal(hasFreshMiss(taste(), LOCK + 1000), false, 'a taste can never fresh-miss')
})

// ---- week frame / chain ----------------------------------------------------------------------

test('weekView marks done / today / todo for the current week frame', () => {
  const ch = mk({ durationDays: 3, checkins: days(0) }) // day 1 open
  const wv = weekView(ch, LOCK + DAY + 1000)
  assert.deepEqual(wv.marks, ['done', 'today', 'todo'])
  assert.equal(wv.label, 'Week 1')
})

test('chainSoFar shows behind-you-plus-today only — nothing ahead', () => {
  const ch = mk({ durationDays: 7, checkins: days(0) }) // day 1 open, days 2-6 not yet real
  assert.deepEqual(chainSoFar(ch, LOCK + DAY + 1000), ['done', 'today'])
  const withMiss = mk({ durationDays: 7, checkins: days(0) })
  assert.deepEqual(chainSoFar(withMiss, LOCK + 2 * DAY + 1000), ['done', 'missed', 'today'])
})

// ---- streak ----------------------------------------------------------------------------------

test('streak counts the open day while it is still winnable', () => {
  // days 0,1 kept, day 2 open and unsealed → 3-day streak (today still winnable)
  assert.equal(streak(mk({ durationDays: 7, checkins: days(0, 1) }), LOCK + 2 * DAY + 1000), 3)
  // today already sealed counts too
  assert.equal(streak(mk({ durationDays: 7, checkins: days(0, 1, 2) }), LOCK + 2 * DAY + 1000), 3)
})

test('a miss breaks the streak — it counts only the run since the miss', () => {
  // missed day 1; kept 0 and 2; now in day 2 (sealed) → streak of 1
  assert.equal(streak(mk({ durationDays: 7, checkins: days(0, 2) }), LOCK + 2 * DAY + 1000), 1)
})

// ---- settlement-backed payoff ----------------------------------------------------------------

test('payoffOf: a perfect run returns the full stake plus a completion bonus', () => {
  const p = payoffOf(mk({ durationDays: 7, stake: 70, checkins: days(0, 1, 2, 3, 4, 5, 6) }))
  assert.equal(p.retained, 70)
  assert.equal(p.forfeited, 0)
  assert.ok(p.bonus > 0, 'perfect finisher earns the bonus')
  assert.equal(p.banked, p.retained + p.bonus)
  assert.equal(p.outcome, 'banked')
})

test('payoffOf: a partial run keeps kept slices and burns the rest, no bonus', () => {
  const p = payoffOf(mk({ durationDays: 7, stake: 70, checkins: days(0, 1, 2) }))
  assert.equal(p.retained, 30)
  assert.equal(p.forfeited, 40)
  assert.equal(p.bonus, 0)
  assert.equal(p.outcome, 'partial')
})

test('payoffOf: a wipeout burns the whole stake', () => {
  const p = payoffOf(mk({ durationDays: 7, stake: 70, checkins: [] }))
  assert.equal(p.retained, 0)
  assert.equal(p.forfeited, 70)
  assert.equal(p.outcome, 'wipeout')
})

test('outcomeOf: staked vs lapsed and the perfect/partial/wipeout split', () => {
  assert.equal(outcomeOf(0, 7, false), 'lapsed', 'never staked → lapsed regardless of days')
  assert.equal(outcomeOf(7, 7, true), 'banked')
  assert.equal(outcomeOf(0, 7, true), 'wipeout')
  assert.equal(outcomeOf(3, 7, true), 'partial')
})

// ---- lifetime record -------------------------------------------------------------------------

test('goalRecord sums kept days for a template across history and the active run', () => {
  const history: HistoryItem[] = [
    { id: 'h1', templateId: 'run', goal: 'Run', emoji: '🏃', outcome: 'partial', kept: 4, total: 7, stake: 70, endedAt: LOCK },
    { id: 'h2', templateId: 'sugar', goal: 'No sugar', emoji: '🍬', outcome: 'banked', kept: 7, total: 7, stake: 70, endedAt: LOCK },
  ]
  const active = mk({ templateId: 'run', checkins: days(0, 1) })
  assert.equal(goalRecord(history, active, 'run'), 6, '4 from history + 2 active')
  assert.equal(goalRecord(history, active, 'sugar'), 7, 'other template ignores the active run')
  assert.equal(goalRecord(history, null, 'nope'), 0)
})
