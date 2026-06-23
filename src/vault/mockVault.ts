import type { StakeRecord, StakeVault } from './types.ts'

// In-memory, no-chain StakeVault so the product UI can run end-to-end before the
// custodial-vs-trustless money layer is chosen. Swap for the real implementation
// (custodial-NIM or trustless-EVM) once the decision is locked — no UI changes.
export function createMockVault(currentAccount = 'me'): StakeVault {
  const store = new Map<string, StakeRecord>()
  const key = (challengeId: string, account: string) => `${challengeId}:${account}`

  return {
    kind: 'mock',
    async deposit({ challengeId, amount }) {
      const rec: StakeRecord = {
        challengeId,
        account: currentAccount,
        amount,
        confirmed: true,
        ref: `mock-${Date.now()}`,
      }
      store.set(key(challengeId, currentAccount), rec)
      return rec
    },
    async getStake({ challengeId, account }) {
      return store.get(key(challengeId, account)) ?? null
    },
  }
}
