// The single, reusable settlement routine — the ONE copy of the money-moving logic, shared
// by the manual CLI (server/settle.ts) and the automated batch settler (server/settle-due.ts).
// Given a challenge id it: verifies deposits on-chain → computes the deterministic split →
// signs payout + burn + finisher-bonus txs offline → persists the signed plan → broadcasts.
//
// Robustness properties (why this is safe to run unattended):
//   - Idempotent: a 'done' settlement record is never re-paid; the signed plan is persisted
//     ('broadcasting') BEFORE any tx goes out, so a crash mid-broadcast recovers by re-sending
//     the SAME (hash-identical) txs — it can never re-sign at a fresh height and double-pay.
//   - Isolated failures: an un-payable participant address is skipped (not fatal); a
//     pre-broadcast error marks the challenge 'failed' and is retried next tick.
//   - Integrity backstop: principal returned can never exceed confirmed on-chain deposits.
//   - Burn ON by default: forfeited slices go to the provably-unspendable burn address.
//
// This is the only module that touches the treasury KEY — it must run only where the key
// lives (the isolated settle service / a trusted machine), never the internet-facing API.

import { Address, KeyPair } from '@nimiq/core'
import { broadcast, buildSignedNim } from './client.ts'
import {
  failSettlement,
  finishSettlement,
  getChallenge,
  getSettlement,
  getSettlementRecord,
  startSettlement,
} from './db.ts'
import { getBalanceLuna, getBlockNumber } from './rpc.ts'
import { verifyChallenge } from './verify.ts'
import { BURN_ADDRESS, loadTreasury, lunaToNim, nimToLuna, treasuryAddress } from './treasury.ts'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

interface PlanTx {
  kind: 'payout' | 'burn'
  to: string
  nim: number
  hash: string
  hex: string
}
type SentTx = { kind: string; to: string; nim: number; hash: string }
const strip = (t: PlanTx): SentTx => ({ kind: t.kind, to: t.to, nim: t.nim, hash: t.hash })

export interface SettleOpts {
  execute?: boolean // default false → dry run (compute + sign, broadcast NOTHING)
  force?: boolean // settle even if the run hasn't fully elapsed
  burn?: boolean // default true → send forfeits to the burn address
  kp?: KeyPair // injectable treasury keypair (tests); defaults to loadTreasury()
  height?: number // injectable validity-start height (tests/batch); defaults to getBlockNumber()
  log?: (msg: string) => void // optional progress logger
}

export type SettleStatus =
  | 'settled' // funds broadcast this run
  | 'recovered' // an interrupted broadcast was completed by re-sending the persisted plan
  | 'already-settled' // a prior 'done' record — nothing to do
  | 'dry-run' // plan computed + signed, nothing broadcast
  | 'skipped' // not due / no confirmed deposits / not found
  | 'failed' // a pre-broadcast error (retried next tick)

export interface SettleResult {
  challengeId: string
  status: SettleStatus
  reason?: string
  planned?: SentTx[]
  sent?: SentTx[]
  skippedParticipants?: { name: string; account: string; nim: number }[]
  burnedPot?: number
  totalOut?: number
}

function isPayable(addr: string): boolean {
  try {
    Address.fromUserFriendlyAddress(addr)
    return true
  } catch {
    return false
  }
}

// A node rejecting an already-known / mined tx means it is on-chain already → treat as sent.
// This is what makes crash-recovery (re-broadcasting the persisted plan) idempotent.
async function broadcastTolerant(t: PlanTx): Promise<string> {
  try {
    return await broadcast({ hash: t.hash, hex: t.hex, to: t.to, valueLuna: nimToLuna(t.nim) })
  } catch (e) {
    const msg = (e as Error).message || ''
    if (/known|exist|duplicate|already|mempool|mined/i.test(msg)) return t.hash
    throw e
  }
}

async function broadcastPlan(plan: PlanTx[], log: (m: string) => void): Promise<SentTx[]> {
  const sent: SentTx[] = []
  for (const t of plan) {
    const hash = await broadcastTolerant(t)
    sent.push({ kind: t.kind, to: t.to, nim: t.nim, hash })
    log(`  sent ${t.kind === 'burn' ? '🔥 ' : ''}${fmt(t.nim)} NIM → ${t.to}  ${hash}`)
  }
  return sent
}

/** Settle one challenge. Safe to call repeatedly — idempotent via the settlements record. */
export async function settleChallenge(id: string, opts: SettleOpts = {}): Promise<SettleResult> {
  const { execute = false, force = false, burn = true } = opts
  const log = opts.log ?? (() => {})

  const view = getChallenge(id)
  if (!view) return { challengeId: id, status: 'skipped', reason: 'challenge not found' }

  // ---- crash recovery: a persisted, in-flight plan → finish it by re-sending the SAME txs.
  const rec = getSettlementRecord(id)
  if (rec?.status === 'done') return { challengeId: id, status: 'already-settled' }
  if (rec?.status === 'broadcasting') {
    const plan = JSON.parse(rec.plan) as PlanTx[]
    if (!execute) {
      return { challengeId: id, status: 'dry-run', reason: 'recovery pending', planned: plan.map(strip), burnedPot: rec.burnedPot, totalOut: rec.totalOut }
    }
    const sent = await broadcastPlan(plan, log)
    finishSettlement(id, JSON.stringify(sent))
    return { challengeId: id, status: 'recovered', sent, burnedPot: rec.burnedPot, totalOut: rec.totalOut }
  }

  // ---- only settle a run that has fully elapsed (unless forced).
  const endAt = view.lockAt + view.durationDays * view.dayLengthMs
  if (Date.now() < endAt && !force) {
    return { challengeId: id, status: 'skipped', reason: 'still running' }
  }

  try {
    // Confirm each stake landed on-chain, then compute the split from confirmed deposits only.
    const v = await verifyChallenge(id)
    const settlement = getSettlement(id)
    if (!settlement || settlement.perParticipant.length === 0) {
      return { challengeId: id, status: 'skipped', reason: 'no confirmed deposits' }
    }

    // Integrity backstop (SEC-01): principal returned must never exceed confirmed deposits.
    // The finisher bonus is sponsor-funded and paid on top, so it's excluded here.
    const principalOutLuna = Number(nimToLuna(settlement.perParticipant.reduce((s, p) => s + p.payout, 0)))
    const confirmedLuna = v?.confirmedLuna ?? 0
    const tolerance = (v?.confirmed ?? 0) + 1 // per-deposit ±1 luna rounding
    if (principalOutLuna > confirmedLuna + tolerance) {
      const reason = `integrity check failed: principal ${principalOutLuna} luna > confirmed ${confirmedLuna} luna`
      failSettlement(id, reason)
      return { challengeId: id, status: 'failed', reason }
    }

    const kp = opts.kp ?? loadTreasury()
    const height = opts.height ?? (await getBlockNumber())

    const plan: PlanTx[] = []
    const skippedParticipants: { name: string; account: string; nim: number }[] = []
    for (const p of settlement.perParticipant) {
      const amount = p.payout + p.nimBonus // retained stake + finisher bonus
      if (amount <= 0) continue
      if (!isPayable(p.account)) {
        // BACKLOG #4: a non-NQ (e.g. dev-fallback) identity can't receive NIM — skip it and
        // settle everyone else, rather than crashing the whole batch.
        skippedParticipants.push({ name: p.name, account: p.account, nim: amount })
        log(`  ⚠️ skip ${p.name}: un-payable address ${p.account} (${fmt(amount)} NIM)`)
        continue
      }
      const signed = buildSignedNim(kp, p.account, nimToLuna(amount), height)
      plan.push({ kind: 'payout', to: p.account, nim: amount, hash: signed.hash, hex: signed.hex })
    }
    if (burn && settlement.burnedPot > 0) {
      const signed = buildSignedNim(kp, BURN_ADDRESS, nimToLuna(settlement.burnedPot), height)
      plan.push({ kind: 'burn', to: BURN_ADDRESS, nim: settlement.burnedPot, hash: signed.hash, hex: signed.hex })
    }

    const totalOut = plan.reduce((s, t) => s + t.nim, 0)

    if (!execute) {
      return { challengeId: id, status: 'dry-run', planned: plan.map(strip), skippedParticipants, burnedPot: settlement.burnedPot, totalOut }
    }
    if (plan.length === 0) {
      return { challengeId: id, status: 'skipped', reason: 'nothing to pay (all forfeited / unpayable)', skippedParticipants }
    }

    // Refuse to move money we don't have (checked only when actually broadcasting).
    const balance = lunaToNim(await getBalanceLuna(treasuryAddress(kp)))
    if (balance < totalOut) {
      const reason = `underfunded: balance ${fmt(balance)} NIM < needed ${fmt(totalOut)} NIM`
      failSettlement(id, reason)
      return { challengeId: id, status: 'failed', reason }
    }

    // Persist the SIGNED plan and flip to 'broadcasting' BEFORE the first tx (crash-safe).
    startSettlement(id, JSON.stringify(plan), settlement.burnedPot, totalOut)
    const sent = await broadcastPlan(plan, log)
    finishSettlement(id, JSON.stringify(sent))
    return { challengeId: id, status: 'settled', sent, skippedParticipants, burnedPot: settlement.burnedPot, totalOut }
  } catch (e) {
    // If we already flipped to 'broadcasting', a failure here means an interrupted broadcast:
    // leave the row intact so the next run RECOVERS it (never overwrite the signed plan).
    if (getSettlementRecord(id)?.status === 'broadcasting') {
      return { challengeId: id, status: 'failed', reason: `broadcast interrupted: ${(e as Error).message}` }
    }
    failSettlement(id, (e as Error).message)
    return { challengeId: id, status: 'failed', reason: (e as Error).message }
  }
}
