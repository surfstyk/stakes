import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { computeSettlement } from '../src/vault/settlement.ts'
import { connect, listDeposits, sendNim } from './client.ts'
import { BURN_ADDRESS, loadTreasury, lunaToNim, nimToLuna, treasuryAddress } from './treasury.ts'

// Operator-triggered settlement. Reads on-chain stake deposits for a challenge
// (source of truth for who staked + how much), applies the supplied completion
// (honor-based, off-chain), then pays each participant their retained NIM (+ a
// sponsor-funded finisher bonus) and BURNS the forfeited remainder.
//
//   node --env-file=.env.local --import tsx server/settle.ts <plan.json>
//
// plan.json:
//   {
//     "challengeId": "ab12cd34",
//     "durationDays": 7,
//     "stake": 100,                       // NIM, expected per deposit
//     "nimBonusPerFinisher": 10,          // optional
//     "completion": { "NQXX...": 5 }      // optional; address->days, default = perfect
//   }

interface Plan {
  challengeId: string
  durationDays: number
  stake: number
  nimBonusPerFinisher?: number
  completion?: Record<string, number>
}

const norm = (s: string) => s.replace(/\s/g, '')

async function main() {
  const planPath = process.argv[2]
  if (!planPath) {
    console.error('usage: node --env-file=.env.local --import tsx server/settle.ts <plan.json>')
    process.exit(1)
  }
  const plan: Plan = JSON.parse(readFileSync(planPath, 'utf8'))

  const settledDir = 'server/.settled'
  const marker = `${settledDir}/${plan.challengeId}.json`
  if (existsSync(marker)) {
    console.error(`Already settled: ${plan.challengeId}. Refusing to double-pay (delete ${marker} to force).`)
    process.exit(1)
  }

  const kp = loadTreasury()
  const treasury = treasuryAddress(kp)
  console.log('treasury:', treasury)
  console.log('connecting to TestAlbatross (this can take a moment)…')
  const client = await connect()
  console.log('consensus established.')

  const deposits = await listDeposits(client, treasury, plan.challengeId)
  if (deposits.length === 0) {
    console.error(`No deposits tagged stakes:${plan.challengeId} found at the treasury.`)
    await client.disconnectNetwork()
    process.exit(1)
  }

  // Invariant: every stake equals the challenge stake. Skip + warn on mismatch.
  const expectedLuna = Number(nimToLuna(plan.stake))
  const seen = new Set<string>()
  const valid = deposits.filter((d) => {
    if (seen.has(norm(d.from))) return false // one stake per address
    seen.add(norm(d.from))
    if (Math.abs(d.valueLuna - expectedLuna) > 1) {
      console.warn(`  skip ${d.from}: staked ${lunaToNim(d.valueLuna)} NIM != expected ${plan.stake}`)
      return false
    }
    return true
  })
  console.log(`settling ${valid.length} participant(s):`)

  const completion = plan.completion ?? {}
  const settlement = computeSettlement({
    stake: plan.stake,
    durationDays: plan.durationDays,
    results: valid.map((d) => ({
      account: d.from,
      daysCompleted: completion[norm(d.from)] ?? plan.durationDays,
    })),
    nimBonusPerFinisher: plan.nimBonusPerFinisher ?? 0,
  })

  const txs: { kind: string; to: string; nim: number; hash: string }[] = []

  for (const p of settlement.perParticipant) {
    const amount = p.payout + p.nimBonus // retained + finisher bonus
    if (amount <= 0) {
      console.log(`  ${p.account}: ${p.daysCompleted}/${plan.durationDays} → nothing returned (all burned)`)
      continue
    }
    const hash = await sendNim(client, kp, p.account, nimToLuna(amount))
    txs.push({ kind: 'payout', to: p.account, nim: amount, hash })
    console.log(
      `  ${p.account}: ${p.daysCompleted}/${plan.durationDays} → ${amount} NIM back` +
        (p.nimBonus ? ` (incl. ${p.nimBonus} bonus)` : '') +
        `  ${hash}`,
    )
  }

  if (settlement.burnedPot > 0) {
    const hash = await sendNim(client, kp, BURN_ADDRESS, nimToLuna(settlement.burnedPot))
    txs.push({ kind: 'burn', to: BURN_ADDRESS, nim: settlement.burnedPot, hash })
    console.log(`  🔥 burned ${settlement.burnedPot} NIM → ${BURN_ADDRESS}  ${hash}`)
  }

  mkdirSync(settledDir, { recursive: true })
  writeFileSync(marker, JSON.stringify({ at: Date.now(), plan, txs }, null, 2))
  console.log('done. marker:', marker)
  await client.disconnectNetwork()
  process.exit(0)
}

main().catch((e) => {
  console.error('settlement failed:', e)
  process.exit(1)
})
