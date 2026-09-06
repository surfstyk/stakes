// Automated batch settler — the job the systemd timer fires (isolated `stakes-settle`
// service, the only place the treasury key lives). Scans for every challenge whose run has
// fully elapsed and isn't yet settled, and settles each (payout + burn + finisher bonus),
// isolating failures so one bad challenge never blocks the others.
//
//   node --env-file=.env.local --import tsx server/settle-due.ts [--execute]
//
// Default = DRY RUN: prints the plan for each due challenge and pre-signs every tx (so any
// error surfaces), but broadcasts NOTHING. --execute actually moves funds. Burn is ON by
// default; set STAKES_SETTLE_NO_BURN=1 to retain forfeits in the treasury instead.
//
// Idempotent by construction (see settle-core.ts): re-running never double-pays.

import { listEndedUnsettled } from './db.ts'
import { seedDue } from './seed-due.ts'
import { wordDue } from './word-due.ts'
import { settleChallenge } from './settle-core.ts'
import { loadTreasury, treasuryAddress } from './treasury.ts'

async function main() {
  const execute = process.argv.includes('--execute')
  const burn = process.env.STAKES_SETTLE_NO_BURN !== '1'
  const kp = loadTreasury() // needed even for a dry run — the plan is pre-signed
  const now = Date.now()
  const ids = listEndedUnsettled(now)

  console.log(
    `[settle-due] ${new Date(now).toISOString()}  treasury=${treasuryAddress(kp)}  ` +
      `${execute ? 'EXECUTE' : 'DRY-RUN'}  burn=${burn}`,
  )
  console.log(`[settle-due] ${ids.length} final & unsettled: ${ids.join(', ') || '(none)'}`)

  // Seeds first: cheap, and a new wallet should hold its sliver before its first stamp.
  const s = await seedDue({ execute, kp, log: (m) => console.log(m) })
  if (s.planned) console.log(`[settle-due] seeds: ${s.planned} pending, ${s.sent} sent, ${s.failed} failed${s.skipped ? ` — ${s.skipped}` : ''}`)

  // Commitment mirrors: the "made it official" moment onto the public feed ("<X> NIM on the word").
  const w = await wordDue({ execute, kp, log: (m) => console.log(m) })
  if (w.planned) console.log(`[settle-due] commitment stamps: ${w.planned} pending, ${w.sent} sent, ${w.failed} failed${w.skipped ? ` — ${w.skipped}` : ''}`)

  const tally: Record<string, number> = {}
  let paidOut = 0
  for (const id of ids) {
    try {
      const r = await settleChallenge(id, { execute, burn, kp, log: (m) => console.log(m) })
      tally[r.status] = (tally[r.status] ?? 0) + 1
      if (r.status === 'settled' || r.status === 'recovered') paidOut += r.totalOut ?? 0
      const money = r.totalOut != null ? `  (${r.totalOut} NIM${r.burnedPot ? `, burn ${r.burnedPot}` : ''})` : ''
      console.log(`[settle-due]   ${id}: ${r.status}${r.reason ? ` — ${r.reason}` : ''}${money}`)
      for (const s of r.skippedParticipants ?? []) {
        console.log(`[settle-due]     ⚠️ ${s.name} unpayable (${s.account}) — ${s.nim} NIM not sent`)
      }
    } catch (e) {
      // settle-core isolates its own failures; this is a last-resort guard so the loop
      // always advances to the next challenge no matter what.
      tally.error = (tally.error ?? 0) + 1
      console.error(`[settle-due]   ${id}: ERROR — ${(e as Error).message}`)
    }
  }

  const summary = Object.entries(tally).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing to do'
  console.log(`[settle-due] done: ${summary}${paidOut ? `  ·  ${paidOut} NIM moved` : ''}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[settle-due] fatal:', e?.message ?? e)
  process.exit(1)
})
