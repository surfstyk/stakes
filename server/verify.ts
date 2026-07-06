// Deposit verification — the "Verify" half of the money flow (MVP.md §Money flow):
// confirm each participant's stake actually landed before settlement counts it.
//
//  - mock/dev deposits (no tx hash, or a `mock-…` ref from the mock vault) are
//    auto-confirmed: there's nothing on-chain to check, and this keeps the whole
//    create→join→settle loop runnable in a plain browser.
//  - real deposits are confirmed against the treasury's on-chain `stakes:<id>` txs,
//    matched by sender address + (~) stake value; the canonical chain hash is saved.
//
// Best-effort: if the treasury isn't configured or the RPC is unreachable, real
// deposits simply stay unconfirmed (settlement skips them) — never throws.

import { attributeDeposits } from './attribute.ts'
import { confirmDeposit, getChallenge } from './db.ts'
import { listStakeDeposits } from './rpc.ts'

// Public treasury address only — the API never holds the treasury KEY (it stays off the
// internet-facing box; see DEPLOYMENT.md). Verification is read-only chain access.
const TREASURY = (process.env.STAKES_TREASURY_ADDRESS ?? process.env.VITE_TREASURY_NIM_ADDRESS ?? '').trim()
const LUNA_PER_NIM = 100_000

const isMock = (hash?: string | null) => !hash || hash.startsWith('mock-')

export interface VerifyResult {
  confirmed: number
  total: number
  onChain: boolean // whether an on-chain lookup was performed
  confirmedLuna: number // total on-chain value backing confirmations (for the settlement invariant)
}

/** Confirm a challenge's stake deposits and persist the result. */
export async function verifyChallenge(challengeId: string): Promise<VerifyResult | null> {
  const view = getChallenge(challengeId)
  if (!view) return null

  const expectedLuna = Math.round(view.stake * LUNA_PER_NIM)
  const onChain = Boolean(TREASURY) && view.participants.some((p) => !isMock(p.depositTxHash))

  let deposits: { from: string; valueLuna: number; hash: string }[] = []
  if (onChain) {
    try {
      deposits = await listStakeDeposits(TREASURY, challengeId)
    } catch (e) {
      console.warn('verify: chain read failed; real deposits stay unconfirmed —', (e as Error).message)
    }
  }

  let confirmed = 0
  let confirmedLuna = 0

  // Mock/dev deposits have nothing on-chain to check → auto-confirm (keeps the whole
  // loop runnable in a plain browser). Count their nominal value toward the invariant.
  const mock = view.participants.filter((p) => isMock(p.depositTxHash))
  for (const p of mock) {
    confirmDeposit(challengeId, p.address, p.depositTxHash ?? null, true)
    confirmed++
    confirmedLuna += expectedLuna
  }

  // Real deposits: attribute on-chain deposits to participants, consuming each once
  // (server/attribute.ts). This is what stops one real deposit confirming two people.
  const real = view.participants.filter((p) => !isMock(p.depositTxHash))
  for (const m of attributeDeposits(real, deposits, expectedLuna)) {
    confirmDeposit(challengeId, m.address, m.hash, m.confirmed)
    if (m.confirmed) {
      confirmed++
      confirmedLuna += m.valueLuna
    }
  }

  return { confirmed, total: view.participants.length, onChain, confirmedLuna }
}
