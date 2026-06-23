// Shared domain types + the swappable money-layer interface.
//
// The custodial-vs-trustless decision is isolated entirely behind `StakeVault`.
// The whole product is built against this interface (and a mock implementation),
// so the real money layer — custodial-NIM or trustless-EVM escrow — is slotted in
// later without touching any UI. This is what lets us build now while the decision
// is still pending the Skool answer.

export type Asset = 'NIM' | 'USDT'

export interface Challenge {
  id: string
  title: string
  durationDays: number
  stake: number // whole units of `asset`
  asset: Asset
}

export interface Participant {
  account: string // chain-agnostic handle (NIM/EVM address or app user id)
  displayName: string
}

/** Per-participant completion at settlement: how many of the N days were done. */
export interface CompletionResult {
  account: string
  daysCompleted: number
}

export interface StakeRecord {
  challengeId: string
  account: string
  amount: number
  confirmed: boolean
  ref?: string // tx hash / receipt reference
}

/** The swappable money layer (client-facing surface). */
export interface StakeVault {
  readonly kind: 'mock' | 'custodial-nim' | 'trustless-evm'
  /** Commit the current user's stake for a challenge. Resolves once funds are in. */
  deposit(input: { challengeId: string; amount: number; asset: Asset }): Promise<StakeRecord>
  /** Read a participant's stake status for a challenge. */
  getStake(input: { challengeId: string; account: string }): Promise<StakeRecord | null>
}
