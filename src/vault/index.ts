import type { StakeVault } from './types.ts'
import { createMockVault } from './mockVault.ts'
import { TREASURY_NIM_ADDRESS, createCustodialNimVault } from './custodialNim.ts'

export type { StakeVault } from './types.ts'

// Pick the money layer at runtime. Use the real custodial-NIM vault only when the
// Nimiq provider is present (inside Nimiq Pay) AND a treasury is configured; otherwise
// fall back to the mock so the flow stays fully clickable in a plain browser.
export function getVault(): StakeVault {
  const inNimiqPay = typeof window !== 'undefined' && Boolean(window.nimiq)
  if (inNimiqPay && TREASURY_NIM_ADDRESS) return createCustodialNimVault()
  return createMockVault()
}
