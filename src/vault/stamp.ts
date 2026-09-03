import { buildPayload } from './payload.ts'
import { getNimiq, txHashOrThrow } from '../lib/nimiq.ts'
import { TREASURY_NIM_ADDRESS } from './custodialNim.ts'

// The stamp — every check-in in every mode puts the day on the chain (ONBOARDING.md §1.8a).
//
// Mechanism (P4 Option A, the requirement): a free NIM dust transaction from the USER'S wallet to
// the published stamp address, tagged `stakes.day day:<id>:<n>`. One native confirm; the wallet
// itself transacts (that is the traction metric). The stamp address is separate from the treasury
// so its explorer page reads as a live feed of check-ins, and the dust recycles to us.
//
// Rules of the ritual: the stamp is offered, never a wall — a declined or failed stamp still
// counts the check-in in-app and re-offers next time (the caller handles that; this module only
// sends). Same build-time invariant as the vault: mock stamps exist ONLY in a mock build.

export const STAMP_ADDRESS = (import.meta.env.VITE_STAMP_ADDRESS ?? '').trim()
/** Dust value per stamp, in luna. 1 luna is the protocol minimum for a value transfer. */
export const STAMP_VALUE_LUNA = Math.max(1, Number(import.meta.env.VITE_STAMP_VALUE_LUNA ?? 1) || 1)

export interface StampReceipt {
  hash: string
  payload: string
  mock: boolean
}

/**
 * Stamp a check-in on the chain. `dayIndex` is the engine's 0-based day; the payload carries the
 * human 1-based day number. Resolves to the tx hash once the user confirmed in Nimiq Pay; rejects
 * if they declined (the caller keeps the in-app check-in either way).
 */
export async function sendStamp(input: { challengeId: string; dayIndex: number }): Promise<StampReceipt> {
  const payload = buildPayload('day', input.challengeId, input.dayIndex + 1)
  if (!STAMP_ADDRESS) {
    // Never fake a stamp in a real-money build: that would silently drop the on-chain record.
    if (TREASURY_NIM_ADDRESS) throw new Error('Stamp address not configured (VITE_STAMP_ADDRESS).')
    return { hash: `mock-stamp-${Date.now()}`, payload, mock: true }
  }
  const nimiq = await getNimiq()
  const hash = txHashOrThrow(
    await nimiq.sendBasicTransactionWithData({
      recipient: STAMP_ADDRESS,
      value: STAMP_VALUE_LUNA,
      data: payload,
    }),
  )
  return { hash, payload, mock: false }
}
