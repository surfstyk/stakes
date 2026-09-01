// The reshape data model — derived FROM the artboards (JOURNEY §1), not the reverse.
//
// Three nouns: Goal (templateId, carries streak + lifetime record) · Challenge/run · Check-in.
// The clock is the SAME engine step 0 ships (vault/schedule.ts) and the payoff figures are the
// SAME deterministic settlement (vault/settlement.ts) — so the app and the settler never disagree.

import type { Asset } from '../vault/types.ts'
import { dayState } from '../vault/schedule.ts'
import { computeSettlement, finisherBonus } from '../vault/settlement.ts'

export type { Asset } from '../vault/types.ts'

/**
 * Per-day state of a participant's streak, in day order — the shared vocabulary so a
 * missed day lands in the SAME position everywhere (not just "first N filled").
 */
export type DayMark = 'done' | 'missed' | 'today' | 'todo'

/** window = the 24h taste (time-only) · official = staked & running · then ended → settled | lapsed. */
export type ChallengeStatus = 'window' | 'official' | 'ended' | 'settled' | 'lapsed'

export type Outcome = 'banked' | 'partial' | 'wipeout' | 'lapsed'

export interface CheckIn {
  day: number // 0-indexed
  at: number
  stampTxHash?: string | null
  stampStatus?: 'pending' | 'declined' | 'landed'
}

export interface Challenge {
  id: string
  templateId: string
  goal: string
  emoji: string
  status: ChallengeStatus
  creatorAddress: string
  createdAt: number
  /** the Start-day-one tap = the taste start = day 0 start; frozen at conversion (the backdate). */
  lockAt: number
  dayLengthMs: number
  /** 0 until "Make it official"; the stepper picks perDay × durationDays. */
  durationDays: number
  stake: number
  asset: Asset
  /** the deposit moment (undefined while a taste). Day-one grace = max(day-0 end, stakedAt + 15m). */
  stakedAt?: number | null
  checkins: CheckIn[]
  /** small human display number for the contract ("Nº 048"). */
  seq: number
}

export interface HistoryItem {
  id: string
  templateId: string
  goal: string
  emoji: string
  outcome: Outcome
  kept: number
  total: number
  stake: number
  endedAt: number
}

export interface Me {
  active: Challenge | null
  history: HistoryItem[]
}

export interface Social {
  startedThisWeek: Record<string, number>
}

// ---- pure derivations (the screens read these; no side effects) --------------

export const DAY_ONE_GRACE_MS = 15 * 60_000

/** The taste window is exactly day 0's own window — one clock (JOURNEY §2, build call). */
export function isLapsed(ch: Challenge, now: number = Date.now()): boolean {
  return ch.status === 'window' && !ch.stakedAt && now >= ch.lockAt + ch.dayLengthMs
}

/** A staked run whose outcome is final — every day elapsed, or every day already kept
 *  (a perfect run banks the moment the last day is sealed, JOURNEY §12.8). */
export function isRunOver(ch: Challenge, now: number = Date.now()): boolean {
  if (ch.status !== 'official') return false
  const elapsed = now >= ch.lockAt + ch.durationDays * ch.dayLengthMs
  const allKept = keptDays(ch).size >= ch.durationDays
  return elapsed || allKept
}

/** Status as the screens should treat it: a lapsed taste, or an official run that is over. */
export function effectiveStatus(ch: Challenge, now: number = Date.now()): ChallengeStatus {
  if (ch.status === 'window') return isLapsed(ch, now) ? 'lapsed' : 'window'
  if (ch.status === 'official') return isRunOver(ch, now) ? 'ended' : 'official'
  return ch.status
}

/** A run that has come to rest — the payoff or the lapse is showable, then archivable. */
export function isTerminal(ch: Challenge, now: number = Date.now()): boolean {
  const st = effectiveStatus(ch, now)
  return st === 'ended' || st === 'lapsed' || st === 'settled'
}

/** A miss just happened: the previous day went unsealed and today isn't sealed yet (Missed ⓽). */
export function hasFreshMiss(ch: Challenge, now: number = Date.now()): boolean {
  if (effectiveStatus(ch, now) !== 'official') return false
  const cur = currentDay(ch, now)
  if (cur < 1 || cur >= ch.durationDays) return false
  const kept = keptDays(ch)
  return !kept.has(cur - 1) && !kept.has(cur)
}

export function keptDays(ch: Challenge): Set<number> {
  return new Set(ch.checkins.map((c) => c.day))
}

/** The day index whose window is open now (0-based); day 0 during the taste. */
export function currentDay(ch: Challenge, now: number = Date.now()): number {
  const ds = dayState(ch, now)
  if (!ds.started) return -1
  return ds.over ? ch.durationDays : ds.currentDay
}

/** How full the current day's dot should be (0..1) — the elapsed fraction of that day.
 *  A taste is `window` (durationDays 0): it fills as day 0, one clock (JOURNEY §2). */
export function dayFill(ch: Challenge, now: number = Date.now()): number {
  const len = ch.dayLengthMs
  const total = ch.durationDays || 1
  const elapsed = now - ch.lockAt
  if (elapsed <= 0) return 0
  const day = Math.floor(elapsed / len)
  if (day >= total) return 1
  return Math.min(1, Math.max(0, (elapsed % len) / len))
}

export function isCheckedToday(ch: Challenge, now: number = Date.now()): boolean {
  return keptDays(ch).has(currentDay(ch, now))
}

/** Whether today's seal is still open — a member can check in for the open day (with grace). */
export function canCheckInToday(ch: Challenge, now: number = Date.now()): boolean {
  if (ch.status !== 'official') return false
  const cur = currentDay(ch, now)
  if (cur < 0 || cur >= ch.durationDays) {
    // day-one grace: the deposit may have landed just as day 0 elapsed
    return false
  }
  return !keptDays(ch).has(cur)
}

export interface WeekView {
  marks: DayMark[]
  weekIndex: number // 0-based
  label: string // "Week 1"
}

/** The 7-dot frame around the current day (a 3-day run shows 3). fill=time, solid=you. */
export function weekView(ch: Challenge, now: number = Date.now()): WeekView {
  const cur = Math.min(Math.max(currentDay(ch, now), 0), ch.durationDays - 1)
  const weekIndex = Math.floor(cur / 7)
  const start = weekIndex * 7
  const len = Math.min(7, ch.durationDays - start)
  const kept = keptDays(ch)
  const over = effectiveStatus(ch, now) === 'ended' || currentDay(ch, now) >= ch.durationDays
  const marks: DayMark[] = Array.from({ length: len }, (_, i) => {
    const d = start + i
    if (kept.has(d)) return 'done'
    if (!over && d === cur && ch.status === 'official') return 'today'
    if (over || d < cur) return 'missed'
    return 'todo'
  })
  return { marks, weekIndex, label: `Week ${weekIndex + 1}` }
}

/** The current clean-run length — the DayOpen/DaySealed pill. Today counts while it is still
 *  winnable (kept, or the open day not yet missed), so a day-3-open reads "3-day streak" (the
 *  artboard). A miss on a past day breaks it; the pill then shows the run since the miss. */
export function streak(ch: Challenge, now: number = Date.now()): number {
  const kept = keptDays(ch)
  const cur = Math.min(currentDay(ch, now), ch.durationDays - 1)
  if (cur < 0) return 0
  let n = 0
  let d = cur
  if (kept.has(cur) || canCheckInToday(ch, now)) {
    n = 1 // today is kept, or still open and un-missed → you're on it
    d = cur - 1
  }
  while (d >= 0 && kept.has(d)) {
    n++
    d--
  }
  return n
}

export function outcomeOf(kept: number, total: number, wasStaked: boolean): Outcome {
  if (!wasStaked) return 'lapsed'
  if (kept >= total) return 'banked'
  if (kept <= 0) return 'wipeout'
  return 'partial'
}

export interface Payoff {
  kept: number
  total: number
  stake: number
  slice: number
  retained: number // stake returned (payout)
  forfeited: number // burned
  bonus: number // completion bonus (perfect only)
  banked: number // retained + bonus
  outcome: Outcome
}

/** The Banked-screen figures — one participant through the shared settlement math. */
export function payoffOf(ch: Challenge): Payoff {
  const kept = keptDays(ch).size
  const total = ch.durationDays
  const s = computeSettlement({
    stake: ch.stake,
    durationDays: total,
    results: [{ account: ch.creatorAddress, daysCompleted: kept }],
    nimBonusPerFinisher: finisherBonus(ch.stake),
  })
  const p = s.perParticipant[0]
  return {
    kept,
    total,
    stake: ch.stake,
    slice: ch.stake / total,
    retained: p.retained,
    forfeited: p.forfeited,
    bonus: p.nimBonus,
    banked: p.retained + p.nimBonus,
    outcome: outcomeOf(kept, total, true),
  }
}

/** Lifetime kept days on a goal, across every run of that template (ReUp "14 days kept"). */
export function goalRecord(history: HistoryItem[], active: Challenge | null, templateId: string): number {
  let n = history.filter((h) => h.templateId === templateId).reduce((s, h) => s + h.kept, 0)
  if (active && active.templateId === templateId) n += keptDays(active).size
  return n
}
