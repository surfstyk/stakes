import { connect } from './client.ts'
import { loadTreasury, treasuryAddress } from './treasury.ts'

// Diagnostic: confirms the treasury key loads and the node reaches consensus.
//   node --env-file=.env.local --import tsx server/check.ts
async function main() {
  const kp = loadTreasury()
  console.log('treasury address:', treasuryAddress(kp))
  console.log('connecting to TestAlbatross…')
  const client = await connect()
  console.log('consensus established ✓')
  console.log('network id      :', await client.getNetworkId())
  console.log('head height     :', await client.getHeadHeight())
  await client.disconnectNetwork()
  process.exit(0)
}

main().catch((e) => {
  console.error('check failed:', e)
  process.exit(1)
})
