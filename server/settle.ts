// Manual single-challenge settlement (break-glass / one-off). Thin CLI over the shared core
// (server/settle-core.ts), so it moves money the EXACT same way the automated settler does —
// there is only one copy of the money logic. Idempotency + crash-recovery now live in the DB
// (the `settlements` table), so re-running never double-pays.
//
//   node --env-file=.env.local --import tsx server/settle.ts <challengeId> [--execute] [--force] [--no-burn]
//
// Default is a DRY RUN: prints the plan (and pre-signs every tx, so any error surfaces) but
// broadcasts NOTHING. Re-run with --execute to actually move funds. This touches the treasury
// KEY — run it only where the key lives, never the internet-facing API box.
//
// NOTE: once the automated settler is live on the box, run this against the LIVE DB (set
// STAKES_DB to the box's DB, or run it on the box) — the DB is the shared idempotency guard.

import { getBalanceLuna } from './rpc.ts'
import { getChallenge } from './db.ts'
import { settleChallenge } from './settle-core.ts'
import { loadTreasury, lunaToNim, treasuryAddress } from './treasury.ts'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

async function main() {
  const args = process.argv.slice(2)
  const id = args.find((a) => !a.startsWith('--'))
  const execute = args.includes('--execute')
  const force = args.includes('--force')
  const burn = !args.includes('--no-burn')
  if (!id) {
    console.error('usage: node --env-file=.env.local --import tsx server/settle.ts <challengeId> [--execute] [--force] [--no-burn]')
    process.exit(1)
  }

  const kp = loadTreasury()
  const treasury = treasuryAddress(kp)
  const view = getChallenge(id)
  if (!view) {
    console.error(`challenge ${id} not found (STAKES_DB=${process.env.STAKES_DB ?? 'server/stakes.db'})`)
    process.exit(1)
  }
  console.log(`treasury: ${treasury}  ${execute ? '(EXECUTE)' : '(dry run)'}`)
  console.log(`challenge ${id}: "${view.goal}" · ${view.durationDays}d · ${view.stake} ${view.asset} stake`)

  const r = await settleChallenge(id, { execute, force, burn, kp, log: (m) => console.log(m) })

  if (r.status === 'already-settled') {
    console.log('already settled — nothing to do.')
    process.exit(0)
  }
  if (r.status === 'skipped' || r.status === 'failed') {
    console.error(`${r.status}: ${r.reason}`)
    process.exit(1)
  }

  const rows = r.sent ?? r.planned ?? []
  console.log(`\nsettlement plan — ${rows.length} tx, ${fmt(r.totalOut ?? 0)} NIM out:`)
  for (const t of rows) {
    console.log(`  ${t.kind === 'burn' ? '🔥 burn ' : 'payout '} ${fmt(t.nim)} NIM → ${t.to}  ${t.hash}`)
  }
  for (const s of r.skippedParticipants ?? []) {
    console.log(`  ⚠️ skipped ${s.name} (${s.account}) — ${fmt(s.nim)} NIM unpayable`)
  }
  if (!burn && (r.burnedPot ?? 0) > 0) {
    console.log(`  🔥 burn SKIPPED (--no-burn): ${fmt(r.burnedPot ?? 0)} NIM stays in the treasury`)
  }

  const balance = lunaToNim(await getBalanceLuna(treasury))
  const need = r.totalOut ?? 0
  console.log(`treasury balance: ${fmt(balance)} NIM  (need ${fmt(need)})${balance >= need ? '' : '  ⚠️ UNDERFUNDED'}`)

  if (r.status === 'dry-run') {
    console.log('\nDRY RUN — nothing broadcast. Re-run with --execute to send.')
  } else {
    console.log(`\n${r.status}: ${r.sent?.length ?? 0} tx broadcast.`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('settlement failed:', e?.message ?? e)
  process.exit(1)
})
