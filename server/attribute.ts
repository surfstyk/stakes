// Deposit attribution — the pure, security-critical core of verify.ts (kept separate so
// it's unit-testable with no DB/RPC side-effects; see attribute.test.ts).
//
// Given the challenge's on-chain stake deposits and its participants, decide which
// deposit backs which participant. The rules that make this safe:
//
//   1. Each deposit is CONSUMED at most once. A single on-chain deposit can never
//      confirm two participants → no phantom payouts (SEC-01). The number of
//      confirmations is therefore capped at the number of real deposits.
//   2. Two passes, trustworthy signal first:
//        Pass 1 — match on the OBSERVED on-chain sender (d.from == participant address).
//                 This is authoritative: only the real depositor can produce it.
//        Pass 2 — for anyone still unmatched, fall back to the tx hash they REPORTED on
//                 join. This covers real Nimiq Pay wallets whose sending sub-address
//                 differs from their listAccounts() identity (ARCH-02).
//      A reported hash is NOT a secret (it's on the public chain), so it can never
//      *create* value: by running sender-matches first and consuming deposits, a hash
//      fallback can only ever claim a deposit that no genuine sender already claimed.
//
// The settlement job independently re-checks that total principal paid out never exceeds
// the confirmed on-chain deposit value (server/settle.ts), so even a mis-attribution
// cannot drain the treasury.

import { normAddr } from './rpc.ts'

export interface AttributableParticipant {
  address: string
  depositTxHash?: string | null
}

export interface AttributableDeposit {
  from: string
  valueLuna: number
  hash: string
}

export interface DepositMatch {
  address: string
  /** Canonical on-chain hash that backed the confirmation, or null if unconfirmed. */
  hash: string | null
  /** Deposit value that backed it (luna), for the settlement invariant. 0 if unconfirmed. */
  valueLuna: number
  confirmed: boolean
}

/**
 * Attribute deposits to participants, consuming each deposit once. Value must match the
 * expected stake within 1 luna (rounding). Returns one result per participant, in the
 * participants' input order.
 */
export function attributeDeposits(
  participants: AttributableParticipant[],
  deposits: AttributableDeposit[],
  expectedLuna: number,
): DepositMatch[] {
  const pool = deposits.map((d) => ({ d, used: false }))
  const valueOk = (d: AttributableDeposit) => Math.abs(d.valueLuna - expectedLuna) <= 1
  const claim = (pred: (d: AttributableDeposit) => boolean) =>
    pool.find((e) => !e.used && valueOk(e.d) && pred(e.d))

  const confirmed = new Map<string, DepositMatch>()
  const pending: AttributableParticipant[] = []

  // Pass 1 — authoritative sender match.
  for (const p of participants) {
    const e = claim((d) => normAddr(d.from) === normAddr(p.address))
    if (e) {
      e.used = true
      confirmed.set(p.address, { address: p.address, hash: e.d.hash, valueLuna: e.d.valueLuna, confirmed: true })
    } else {
      pending.push(p)
    }
  }

  // Pass 2 — client-reported hash fallback, only against deposits no sender claimed.
  for (const p of pending) {
    const e = p.depositTxHash ? claim((d) => d.hash === p.depositTxHash) : undefined
    if (e) {
      e.used = true
      confirmed.set(p.address, { address: p.address, hash: e.d.hash, valueLuna: e.d.valueLuna, confirmed: true })
    } else {
      confirmed.set(p.address, { address: p.address, hash: null, valueLuna: 0, confirmed: false })
    }
  }

  // Return in the original participant order.
  return participants.map((p) => confirmed.get(p.address)!)
}
