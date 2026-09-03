// Deposit verification — the "Verify" half of the money flow (MVP.md §Money flow):
// confirm each participant's stake actually landed before settlement counts it.
//
//  - mock/dev deposits (no tx hash, or a `mock-…` ref from the mock vault) are auto-confirmed
//    ONLY in a mock/dev build (no treasury configured): there's nothing on-chain to check, and
//    this keeps the whole create→join→settle loop runnable in a plain browser. On a real-money
//    deployment (treasury set) a missing/`mock-` hash is NEVER confirmed — otherwise a participant
//    could be paid a stake they never deposited (treasury drain).
//  - real deposits are confirmed against the treasury's on-chain `stakes:<id>` txs,
//    matched by sender address + (~) stake value; the canonical chain hash is saved.
//
// Best-effort: if the treasury isn't configured or the RPC is unreachable, real
// deposits simply stay unconfirmed (settlement skips them) — never throws.

import { attributeDeposits } from './attribute.ts'
import { confirmDeposit, getChallenge } from './db.ts'
import { HASH_RE, listStakeDeposits, lookupStakeDeposit, type StakeDeposit } from './rpc.ts'

// Public treasury address only — the API never holds the treasury KEY (it stays off the
// internet-facing box; see DEPLOYMENT.md). Verification is read-only chain access. Read at
// call time (not module load) so the real-money branch is exercisable in tests.
const treasuryAddr = () => (process.env.STAKES_TREASURY_ADDRESS ?? process.env.VITE_TREASURY_NIM_ADDRESS ?? '').trim()
const LUNA_PER_NIM = 100_000

const isMock = (hash?: string | null) => !hash || hash.startsWith('mock-')

export interface VerifyResult {
  confirmed: number
  total: number
  onChain: boolean // whether an on-chain lookup was performed
  confirmedLuna: number // total on-chain value backing confirmations (for the settlement invariant)
}

/** The chain reads verify needs — injectable so the real-money path is testable offline. */
export interface ChainReader {
  listStakeDeposits: (treasury: string, challengeId: string) => Promise<StakeDeposit[]>
  lookupStakeDeposit: (treasury: string, challengeId: string, hash: string) => Promise<StakeDeposit | null>
}
const liveChain: ChainReader = { listStakeDeposits, lookupStakeDeposit }

/** Confirm a challenge's stake deposits and persist the result. */
export async function verifyChallenge(challengeId: string, chain: ChainReader = liveChain): Promise<VerifyResult | null> {
  const view = getChallenge(challengeId)
  if (!view) return null

  const expectedLuna = Math.round(view.stake * LUNA_PER_NIM)
  // Real-money deployment iff a treasury address is configured. This mirrors the client invariant
  // "mock money ⟺ mock build" (src/vault/index.ts): a mock/dev build has no treasury and stays
  // fully clickable; a real build always has one. It is the switch that decides whether a
  // non-on-chain "deposit" may be auto-confirmed.
  const TREASURY = treasuryAddr()
  const REAL_MONEY = Boolean(TREASURY)
  const onChain = REAL_MONEY && view.participants.some((p) => !isMock(p.depositTxHash))

  // Two sources, merged and deduped by hash: (1) every participant's REPORTED hash looked up
  // directly — permanent, immune to the treasury's traffic volume (audit H2); (2) the newest-N scan
  // of the treasury, which is what recovers the sender when the wallet never reported a hash. A
  // transport failure on either side leaves deposits unconfirmed (settlement skips + retries).
  let deposits: { from: string; valueLuna: number; hash: string }[] = []
  if (onChain) {
    const byHash = new Map<string, StakeDeposit>()
    const reported = view.participants.map((p) => p.depositTxHash ?? '').filter((h) => HASH_RE.test(h))
    for (const h of new Set(reported.map((h) => h.toLowerCase()))) {
      try {
        const d = await chain.lookupStakeDeposit(TREASURY, challengeId, h)
        if (d) byHash.set(d.hash.toLowerCase(), d)
      } catch (e) {
        console.warn('verify: hash lookup failed; that deposit stays unconfirmed —', (e as Error).message)
      }
    }
    try {
      for (const d of await chain.listStakeDeposits(TREASURY, challengeId)) byHash.set(d.hash.toLowerCase(), d)
    } catch (e) {
      console.warn('verify: chain scan failed; unreported deposits stay unconfirmed —', (e as Error).message)
    }
    deposits = [...byHash.values()].map((d) => ({ ...d, hash: d.hash.toLowerCase() }))
  }

  let confirmed = 0
  let confirmedLuna = 0

  // Deposits with no on-chain hash (null, or a `mock-…` ref from the mock vault).
  const mock = view.participants.filter((p) => isMock(p.depositTxHash))
  for (const p of mock) {
    // SECURITY (treasury drain): on a real-money deployment a missing/`mock-` hash is NOT proof
    // of any on-chain stake, so it must NEVER be auto-confirmed — doing so would let a participant
    // be paid (or have a phantom stake burned) for money they never deposited, defeating the
    // "principal ≤ confirmed deposits" backstop in settle-core.ts. Only a genuine on-chain deposit
    // (matched below by sender/hash) confirms a stake against real funds. A plain dev/test build
    // (no treasury) still auto-confirms so the whole loop runs in a browser with no chain.
    if (REAL_MONEY) {
      confirmDeposit(challengeId, p.address, null, false)
      continue
    }
    confirmDeposit(challengeId, p.address, p.depositTxHash ?? null, true)
    confirmed++
    confirmedLuna += expectedLuna
  }

  // Real deposits: attribute on-chain deposits to participants, consuming each once
  // (server/attribute.ts). This is what stops one real deposit confirming two people.
  // Hashes compare case-insensitively (the wallet may report upper-case; the chain returns lower).
  const real = view.participants
    .filter((p) => !isMock(p.depositTxHash))
    .map((p) => ({ ...p, depositTxHash: p.depositTxHash?.toLowerCase() ?? null }))
  for (const m of attributeDeposits(real, deposits, expectedLuna)) {
    confirmDeposit(challengeId, m.address, m.hash, m.confirmed)
    if (m.confirmed) {
      confirmed++
      confirmedLuna += m.valueLuna
    }
  }

  return { confirmed, total: view.participants.length, onChain, confirmedLuna }
}
