import type { StakeRecord, StakeVault } from './types.ts'
import { getNimiq, nimToLuna } from '../lib/nimiq.ts'

// Cycle-I money layer (locked 2026-06-23): custodial-NIM.
// The user gaslessly sends NIM to the Stakes treasury via the Nimiq provider; the
// (future) backend attributes the deposit by the tagged `data` field and runs the
// deterministic settlement. NIM L1 is free + instant, and this is the only confirmed
// gasless, Mini-App-native path. Isolated behind StakeVault so we can later swap in a
// USDT/trustless implementation (OpenGSN relayer) without touching the UI.

// Set this to the real Stakes treasury NIM address to go live. While empty, the app
// falls back to the mock vault (see src/vault/index.ts) so the flow stays clickable.
export const TREASURY_NIM_ADDRESS = ''

export function createCustodialNimVault(currentAccount = 'me'): StakeVault {
  return {
    kind: 'custodial-nim',
    async deposit({ challengeId, amount, asset }) {
      if (asset !== 'NIM') throw new Error('Cycle-I custodial vault supports NIM only.')
      if (!TREASURY_NIM_ADDRESS) throw new Error('Treasury address not configured.')
      const nimiq = await getNimiq()
      const hash = await nimiq.sendBasicTransactionWithData({
        recipient: TREASURY_NIM_ADDRESS,
        value: nimToLuna(amount),
        data: `stakes:${challengeId}`, // lets the backend attribute the deposit
      })
      const rec: StakeRecord = { challengeId, account: currentAccount, amount, confirmed: true, ref: hash }
      return rec
    },
    async getStake() {
      // On-chain attribution needs the backend; not available client-side yet.
      return null
    },
  }
}
