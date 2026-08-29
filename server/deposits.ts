import { getTransactionsByAddress, normAddr } from './rpc.ts'
import { loadTreasury, lunaToNim, treasuryAddress } from './treasury.ts'
import { parsePayload } from '../src/vault/payload.ts'

// Lists every stake deposit at the treasury and decodes its tag (`stakes.day official:<id>`, or
// the Cycle-I `stakes:<id>`), so we can recover challenge ids and confirm deposits landed straight
// from chain over HTTP-RPC.
//   node --env-file=.env.local --import tsx server/deposits.ts

const decode = (hex: string) => {
  try {
    return Buffer.from(hex, 'hex').toString('utf8')
  } catch {
    return ''
  }
}

async function main() {
  const treasury = treasuryAddress(loadTreasury())
  console.log('treasury:', treasury)
  const txs = await getTransactionsByAddress(treasury, 500)
  const rows = txs
    .filter((t) => normAddr(t.to) === normAddr(treasury))
    .map((t) => ({ tag: parsePayload(decode(t.recipientData)), from: t.from, nim: lunaToNim(t.value), hash: t.hash, at: t.timestamp }))
    .filter((r) => r.tag?.verb === 'official')
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))

  console.log(`\nfound ${rows.length} stake deposit(s):`)
  for (const r of rows) {
    console.log(`  challengeId=${r.tag!.challengeId}  ${r.nim} NIM  from ${r.from}  (${r.hash})`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('failed:', e?.message ?? e)
  process.exit(1)
})
