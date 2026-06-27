import { getBalanceLuna, getBlockNumber } from './rpc.ts'
import { loadTreasury, lunaToNim, treasuryAddress } from './treasury.ts'

// Diagnostic: confirms the treasury key loads and the chain RPC is reachable + funded.
//   node --env-file=.env.local --import tsx server/check.ts
async function main() {
  const treasury = treasuryAddress(loadTreasury())
  console.log('treasury address:', treasury)
  console.log('head block      :', await getBlockNumber())
  console.log('treasury balance:', lunaToNim(await getBalanceLuna(treasury)), 'NIM')
  process.exit(0)
}

main().catch((e) => {
  console.error('check failed:', e?.message ?? e)
  process.exit(1)
})
