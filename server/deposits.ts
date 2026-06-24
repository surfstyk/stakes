import { connect } from './client.ts'
import { loadTreasury, lunaToNim, treasuryAddress } from './treasury.ts'

// Lists every stake deposit at the treasury and decodes its `stakes:<id>` tag, so
// we can recover challenge ids (and confirm deposits landed) straight from chain.
//   node --env-file=.env.local --import tsx server/deposits.ts

const norm = (s: string) => s.replace(/\s/g, '')

// Hard watchdog so this can never hang the session.
const watchdog = setTimeout(() => {
  console.error('TIMEOUT: could not reach the Nimiq testnet in time (P2P likely blocked here).')
  process.exit(2)
}, 150_000)

async function main() {
  const kp = loadTreasury()
  const treasury = treasuryAddress(kp)
  console.log('treasury:', treasury)
  console.log('connecting to TestAlbatross…')
  const client = await connect()
  console.log('consensus established. reading treasury history…')

  const txs = await client.getTransactionsByAddress(treasury, 0, null, null, 500, 1)
  const rows = txs
    .filter((tx) => norm(tx.recipient) === norm(treasury) && tx.data?.type === 'raw')
    .map((tx) => {
      let tag = ''
      try {
        tag = Buffer.from((tx.data as { raw: string }).raw, 'hex').toString('utf8')
      } catch {
        /* ignore */
      }
      return { tag, from: tx.sender, nim: lunaToNim(tx.value), hash: tx.transactionHash, at: tx.timestamp }
    })
    .filter((r) => r.tag.startsWith('stakes:'))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))

  console.log(`\nfound ${rows.length} stake deposit(s):`)
  for (const r of rows) {
    console.log(`  challengeId=${r.tag.slice('stakes:'.length)}  ${r.nim} NIM  from ${r.from}  (${r.hash})`)
  }

  clearTimeout(watchdog)
  await client.disconnectNetwork()
  process.exit(0)
}

main().catch((e) => {
  console.error('failed:', e?.message ?? e)
  process.exit(1)
})
