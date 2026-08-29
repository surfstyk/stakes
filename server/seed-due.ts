// The seed pass — sends the silent NIM sliver to every wallet the API has queued (server/db.ts
// `seeds`), tagged `stakes.day seed:<challengeId>`. Runs inside the isolated `stakes-settle`
// tick (server/settle-due.ts) because that is the only process holding the treasury key; the
// internet-facing API only ever QUEUES a seed (rate-limited, one per wallet).
//
// Guards: bounded attempts per row; a treasury floor so seeding can never starve settlements;
// the STAKES_SEED_OFF kill switch is honoured at the API (nothing new gets queued) — pending rows
// still drain here so nobody who was promised a seed is left without one.

import { KeyPair } from '@nimiq/core'
import { broadcast, buildSignedNim } from './client.ts'
import { listPendingSeeds, markSeedFailed, markSeedSent } from './db.ts'
import { getBalanceLuna, getBlockNumber } from './rpc.ts'
import { treasuryAddress } from './treasury.ts'
import { buildPayload } from '../src/vault/payload.ts'

/** Below this treasury balance we stop seeding (payouts come first). */
export const TREASURY_FLOOR_LUNA = BigInt(Math.round(Number(process.env.STAKES_TREASURY_FLOOR_NIM ?? 1000) * 100_000))

export interface SeedDueOpts {
  execute?: boolean // default false → dry run: sign, log, send nothing
  kp: KeyPair
  height?: number // injectable (tests); defaults to getBlockNumber()
  balanceLuna?: bigint // injectable (tests); defaults to the live treasury balance
  log?: (msg: string) => void
}

export interface SeedDueResult {
  planned: number
  sent: number
  failed: number
  skipped?: string
}

export async function seedDue(opts: SeedDueOpts): Promise<SeedDueResult> {
  const { execute = false, kp } = opts
  const log = opts.log ?? (() => {})
  const pending = listPendingSeeds()
  if (pending.length === 0) return { planned: 0, sent: 0, failed: 0 }

  const balance = opts.balanceLuna ?? BigInt(await getBalanceLuna(treasuryAddress(kp)))
  const need = pending.reduce((s, r) => s + BigInt(r.luna), 0n)
  if (balance - need < TREASURY_FLOOR_LUNA) {
    const skipped = `treasury at floor (${balance} luna, need ${need} + floor ${TREASURY_FLOOR_LUNA}) — seeding paused`
    log(`[seed] ${skipped}`)
    return { planned: pending.length, sent: 0, failed: 0, skipped }
  }

  const height = opts.height ?? (await getBlockNumber())
  let sent = 0
  let failed = 0
  for (const row of pending) {
    try {
      const signed = buildSignedNim(kp, row.address, BigInt(row.luna), height, buildPayload('seed', row.challengeId))
      if (!execute) {
        log(`[seed] would send ${row.luna} luna → ${row.address}  ${signed.hash}  [seed:${row.challengeId}]`)
        continue
      }
      const hash = await broadcast(signed)
      markSeedSent(row.address, hash)
      sent++
      log(`[seed] sent ${row.luna} luna → ${row.address}  ${hash}`)
    } catch (e) {
      failed++
      markSeedFailed(row.address, (e as Error).message)
      log(`[seed] ✗ ${row.address}: ${(e as Error).message}`)
    }
  }
  return { planned: pending.length, sent, failed }
}
