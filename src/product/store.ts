// Challenge fetch for the "Open in Nimiq Pay" gate. When someone opens a share link
// (?c=<id>) outside the app, the gate reads the challenge so it can show its context
// before routing them into Nimiq Pay. Reads go through the same-origin `/api` (Vite
// proxy in dev, Caddy reverse_proxy in prod).
//
// This is all that remains of the old Cycle-I product store — the Cycle-II journey has
// its own data layer in src/reshape/.
import type { Asset } from '../vault/types.ts'

// ---- API client ------------------------------------------------------------

const API_BASE = '/api'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body && typeof body.error === 'string') msg = body.error
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ---- shared-state types (mirror the API view in server/db.ts) --------------

export interface Participant {
  address: string // the participant id (Nimiq wallet address, or a dev pseudo-address)
  name: string // display only
  joinedAt: number
  // Note: the deposit tx hash + confirmation flag are deliberately NOT exposed by the API
  // (server-internal verification data — see server/api.ts publicChallenge / SEC-06).
}

export interface CheckIn {
  id: string
  address: string // who checked in (resolve to a name via the participant list)
  day: number // 0-indexed
  note: string
  emoji?: string | null
  at: number
  cheers: number
}

/** A settlement transaction that has been broadcast (or is about to be) — public on-chain. */
export interface SettlementTx {
  kind: 'payout' | 'bonus' | 'burn'
  to: string
  nim: number
  hash: string
}

/** Real settlement state for the results receipt (null until the settler has touched it). */
export interface SettlementView {
  status: 'broadcasting' | 'done'
  at: number
  txs: SettlementTx[]
}

export interface ChallengeRecord {
  id: string
  goal: string
  emoji: string
  durationDays: number
  stake: number
  asset: Asset
  creatorAddress: string
  creatorName: string
  createdAt: number
  lockAt: number // doors close → the challenge starts (day 0 begins)
  dayLengthMs: number // length of each check-in day/round (24h prod, minutes in test)
  status: string
  participants: Participant[]
  checkins: CheckIn[]
  settlement?: SettlementView | null // real payout state once the run has settled
}

/** Full challenge view (+ participants, check-ins). null if it doesn't exist. */
export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
  try {
    return await api<ChallengeRecord>(`/challenges/${id}`)
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null
    console.warn('getChallenge failed', e)
    return null // a transient failure shouldn't dead-end the UI; screens show "not found"
  }
}
