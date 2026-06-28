import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { broadcast, buildSignedNim, type SignedTx } from './client.ts'
import { getChallenge, getSettlement } from './db.ts'
import { getBalanceLuna, getBlockNumber } from './rpc.ts'
import { verifyChallenge } from './verify.ts'
import { BURN_ADDRESS, loadTreasury, lunaToNim, nimToLuna, treasuryAddress } from './treasury.ts'

// Operator-triggered settlement, computed from REAL data in the shared DB:
//   - who staked  = participants whose deposit is CONFIRMED on-chain (server/verify.ts)
//   - completion  = distinct check-in days per participant
// Each participant gets their retained NIM back (+ a sponsor-funded finisher bonus); the
// forfeited remainder is BURNED. Builds + signs offline, broadcasts via HTTP-RPC.
//
//   node --env-file=.env.local --import tsx server/settle.ts <challengeId> [--execute] [--force]
//
// Default is a DRY RUN: it prints the exact plan (and pre-signs every tx, so any error
// surfaces) but broadcasts NOTHING. Re-run with --execute to actually move funds. This is
// the only place the treasury KEY is used — run it on a trusted machine, never the API box.

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

async function main() {
  const args = process.argv.slice(2)
  const id = args.find((a) => !a.startsWith('--'))
  const execute = args.includes('--execute')
  const force = args.includes('--force')
  // --no-burn: skip the burn tx so the forfeited pot stays in the treasury (recoverable)
  // instead of going to the dead burn address. For testing with real NIM — the per-
  // participant outcome is identical, we just don't destroy the forfeits. (Also avoids the
  // "sender == recipient" error a treasury→treasury "refund" tx would throw.)
  const noBurn = args.includes('--no-burn')
  if (!id) {
    console.error('usage: node --env-file=.env.local --import tsx server/settle.ts <challengeId> [--execute] [--force] [--no-burn]')
    process.exit(1)
  }

  const kp = loadTreasury()
  const treasury = treasuryAddress(kp)
  console.log(`treasury: ${treasury}  ${execute ? '(EXECUTE)' : '(dry run)'}`)

  const view = getChallenge(id)
  if (!view) {
    console.error(`challenge ${id} not found in DB (STAKES_DB=${process.env.STAKES_DB ?? 'server/stakes.db'})`)
    process.exit(1)
  }
  console.log(`challenge ${id}: "${view.goal}" · ${view.durationDays}d · ${view.stake} ${view.asset} stake`)

  const endAt = view.lockAt + view.durationDays * view.dayLengthMs
  if (Date.now() < endAt && !force) {
    console.error(`Challenge still running (ends ${new Date(endAt).toISOString()}). Re-run with --force to settle now.`)
    process.exit(1)
  }

  console.log('verifying deposits on-chain…')
  const v = await verifyChallenge(id)
  console.log(`  ${v?.confirmed ?? 0}/${v?.total ?? 0} deposits confirmed${v?.onChain ? ' (on-chain)' : ' (mock/dev)'}`)

  const settlement = getSettlement(id)
  if (!settlement || settlement.perParticipant.length === 0) {
    console.error('No confirmed deposits to settle.')
    process.exit(1)
  }

  // Build the tx plan from the computed settlement. One head height for the whole batch.
  const height = await getBlockNumber()
  const plan: { kind: 'payout' | 'burn'; to: string; nim: number; signed: SignedTx }[] = []
  for (const p of settlement.perParticipant) {
    const amount = p.payout + p.nimBonus // retained stake + finisher bonus
    if (amount <= 0) {
      console.log(`  ${p.name}: ${p.daysCompleted}/${view.durationDays} → nothing back (all forfeited)`)
      continue
    }
    plan.push({ kind: 'payout', to: p.account, nim: amount, signed: buildSignedNim(kp, p.account, nimToLuna(amount), height) })
  }
  if (settlement.burnedPot > 0) {
    if (noBurn) {
      console.log(`  🔥 burn SKIPPED (--no-burn): ${fmt(settlement.burnedPot)} NIM stays in the treasury`)
    } else {
      plan.push({
        kind: 'burn',
        to: BURN_ADDRESS,
        nim: settlement.burnedPot,
        signed: buildSignedNim(kp, BURN_ADDRESS, nimToLuna(settlement.burnedPot), height),
      })
    }
  }

  const totalOut = plan.reduce((s, t) => s + t.nim, 0)
  console.log(`\nsettlement plan — ${plan.length} tx, ${fmt(totalOut)} NIM out:`)
  for (const t of plan) {
    console.log(`  ${t.kind === 'burn' ? '🔥 burn ' : 'payout '} ${fmt(t.nim)} NIM → ${t.to}  ${t.signed.hash}`)
  }

  const balance = lunaToNim(await getBalanceLuna(treasury))
  const funded = balance >= totalOut
  console.log(`treasury balance: ${fmt(balance)} NIM  (need ${fmt(totalOut)})${funded ? '' : '  ⚠️ UNDERFUNDED'}`)

  if (!execute) {
    console.log('\nDRY RUN — nothing broadcast. Re-run with --execute to send.')
    process.exit(0)
  }

  // ---- execute ----
  const settledDir = 'server/.settled'
  const marker = `${settledDir}/${id}.json`
  if (existsSync(marker)) {
    console.error(`Already settled: ${id}. Refusing to double-pay (delete ${marker} to force).`)
    process.exit(1)
  }
  if (!funded) {
    console.error('Refusing to execute: treasury underfunded for this settlement.')
    process.exit(1)
  }

  // Persist the signed plan BEFORE broadcasting so an interrupted run can't re-sign with a
  // fresh height (the same signed tx re-sent is network-idempotent by hash).
  mkdirSync(settledDir, { recursive: true })
  const record = {
    at: Date.now(),
    challengeId: id,
    status: 'broadcasting',
    settlement,
    txs: plan.map((t) => ({ kind: t.kind, to: t.to, nim: t.nim, hash: t.signed.hash, hex: t.signed.hex })),
  }
  writeFileSync(marker, JSON.stringify(record, null, 2))

  console.log('\nbroadcasting…')
  const sent: { kind: string; to: string; nim: number; hash: string }[] = []
  for (const t of plan) {
    const hash = await broadcast(t.signed)
    sent.push({ kind: t.kind, to: t.to, nim: t.nim, hash })
    console.log(`  sent ${fmt(t.nim)} NIM → ${t.to}  ${hash}`)
  }

  writeFileSync(marker, JSON.stringify({ ...record, status: 'done', sent }, null, 2))
  console.log('done. marker:', marker)
  process.exit(0)
}

main().catch((e) => {
  console.error('settlement failed:', e?.message ?? e)
  process.exit(1)
})
