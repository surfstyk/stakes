import type { StakeVault } from './types.ts'
import { createMockVault } from './mockVault.ts'
import { TREASURY_NIM_ADDRESS, createCustodialNimVault } from './custodialNim.ts'

export type { StakeVault } from './types.ts'

// Pick the money layer at build time. Invariant: **mock money ⟺ mock build.**
//
// A real-money build (treasury configured) ALWAYS uses the custodial vault — which
// requires the Nimiq provider and throws a clear error if it's missing. We must never
// silently fake a real-money stake under a throwaway identity (the trap that killed the
// viral loop): the App shell already routes real-money/out-of-Nimiq-Pay users to the
// "Open in Nimiq Pay" gate before any money action; refusing to mock here is the last
// line of defense if that's ever bypassed. A mock build (no treasury) stays fully
// clickable in a plain browser for local dev/testing.
export function getVault(): StakeVault {
  if (TREASURY_NIM_ADDRESS) return createCustodialNimVault()
  return createMockVault()
}
