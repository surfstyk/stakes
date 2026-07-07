// The "closing door" engine — where a challenge is in real time. This is what makes
// "miss a day → forfeit" real: you can only check in for the day whose window is open
// *now*, so a missed day's window closes for good.
//
// Kept pure and dependency-free so BOTH sides compute it identically: the client
// (ProgressScreen shows/enables the open day) and the server (rejects a check-in for any
// other day — server/api.ts). Same single-source-of-truth discipline as settlement.ts;
// enforcing it only in the browser is what left the forfeit mechanic bypassable (SEC-03).

export const DAY_MS = 24 * 3600_000 // a real check-in "day"

export interface Schedule {
  lockAt: number // doors close → day 0 begins
  durationDays: number
  dayLengthMs: number // length of each check-in day/round (24h prod, minutes in test)
}

export interface DayState {
  started: boolean // doors closed → the challenge has begun
  over: boolean // all days elapsed → time to settle
  currentDay: number // the day whose window is open now (-1 before start, durationDays once over)
  msUntilStart: number // >0 while still in the join window
  msLeftInDay: number // time left to check in for the current day
  totalDays: number
}

/**
 * Day k's window is [lockAt + k·dayLength, lockAt + (k+1)·dayLength). Accepts anything
 * shaped like a Schedule (a full ChallengeRecord works).
 */
export function dayState(s: Schedule, now: number = Date.now()): DayState {
  const len = s.dayLengthMs || DAY_MS
  const total = s.durationDays
  if (now < s.lockAt) {
    return { started: false, over: false, currentDay: -1, msUntilStart: s.lockAt - now, msLeftInDay: 0, totalDays: total }
  }
  const elapsed = now - s.lockAt
  const idx = Math.floor(elapsed / len)
  if (idx >= total) {
    return { started: true, over: true, currentDay: total, msUntilStart: 0, msLeftInDay: 0, totalDays: total }
  }
  return {
    started: true,
    over: false,
    currentDay: idx,
    msUntilStart: 0,
    msLeftInDay: (idx + 1) * len - elapsed,
    totalDays: total,
  }
}

/** The day index whose check-in window is open now, or -1 if none (before start / after end). */
export function openDay(s: Schedule, now: number = Date.now()): number {
  const st = dayState(s, now)
  return st.started && !st.over ? st.currentDay : -1
}
