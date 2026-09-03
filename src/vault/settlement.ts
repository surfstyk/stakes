import type { CompletionResult } from './types.ts'

// Deterministic settlement math — the shared core both the app and (later) backend
// use. No randomness anywhere → satisfies the no-gambling / no-chance rule.
//
// Rules (CONCEPT §4–§5, as amended 2026-06-23):
//   - Each participant stakes `stake` over `durationDays`. Per-day slice = stake / days.
//   - Completing a day keeps that slice; missing it forfeits that slice.
//   - Forfeited slices are BURNED (sent to a provably-unspendable address) — removed
//     from circulation. No beneficiary → can't be wagering; no curation/ops → no charity
//     rabbit hole; the loss stays real (brand + loss-aversion intact). For NIM it's
//     deflationary / ecosystem-aligned.
//   - Perfect finishers get their full stake back plus a NIM completion bonus + badge.
//     The bonus is sponsor/treasury-funded, NOT taken from forfeits — so finishers are
//     rewarded without anyone profiting from a quitter's loss.

export interface SettlementInput {
  stake: number // per-participant stake (uniform across participants)
  durationDays: number
  results: CompletionResult[]
  nimBonusPerFinisher?: number
}

export interface ParticipantPayout {
  account: string
  daysCompleted: number
  staked: number
  retained: number // returned to the participant (stake asset)
  forfeited: number // burned
  payout: number // = retained
  nimBonus: number // completion bonus, perfect finishers only (sponsor-funded)
  isPerfectFinisher: boolean
}

export interface SettlementOutput {
  perParticipant: ParticipantPayout[]
  burnedPot: number // total forfeited → burned (removed from circulation)
  perfectFinishers: number
}

export function computeSettlement(input: SettlementInput): SettlementOutput {
  const { stake, durationDays, results, nimBonusPerFinisher = 0 } = input
  if (durationDays <= 0) throw new Error('durationDays must be > 0')

  const slice = stake / durationDays

  const perParticipant: ParticipantPayout[] = results.map((r) => {
    const days = Math.max(0, Math.min(durationDays, r.daysCompleted))
    const retained = slice * days
    const isPerfectFinisher = days === durationDays
    return {
      account: r.account,
      daysCompleted: days,
      staked: stake,
      retained,
      forfeited: stake - retained,
      payout: retained,
      nimBonus: isPerfectFinisher ? nimBonusPerFinisher : 0,
      isPerfectFinisher,
    }
  })

  const burnedPot = perParticipant.reduce((sum, p) => sum + p.forfeited, 0)
  const perfectFinishers = perParticipant.filter((p) => p.isPerfectFinisher).length

  return { perParticipant, burnedPot, perfectFinishers }
}

// ---- the completion-bonus policy (decided 2026-08-28, amended 2026-09-03) --------------------
// A share of the stake, capped, EARNED BY DAYS KEPT: a full week earns the full bonus, a shorter
// run a proportional share (1 day = 1/7). So the bonus rewards following through, not deposit size
// or run-slicing — a 1-day run can't collect a whole week's bonus, and a wallet earns roughly the
// same per kept day however it cuts its runs (audit H1). One place, used by both the server plan
// (server/db.ts) and the in-app preview (model.ts). The settler additionally enforces one bonus per
// wallet per day + a global daily budget (server/settle-core.ts).
export const FINISHER_BONUS_RATE = 0.15
export const FINISHER_BONUS_CAP_NIM = 50
export const FINISHER_BONUS_FULL_DAYS = 7

export function finisherBonus(stake: number, durationDays: number = FINISHER_BONUS_FULL_DAYS): number {
  if (!(stake > 0) || !(durationDays > 0)) return 0
  const full = Math.min(FINISHER_BONUS_CAP_NIM, stake * FINISHER_BONUS_RATE)
  const share = Math.min(1, durationDays / FINISHER_BONUS_FULL_DAYS)
  return Math.round(full * share * 100) / 100
}
