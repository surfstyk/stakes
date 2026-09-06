// The commitment-mirror pass — for every challenge the API queued at /official (server/db.ts
// `word_stamps`), sends ONE dust tx from the treasury to the published stamp address, tagged as the
// human line "<X> NIM on the word · <id>" (src/vault/payload.ts commitmentLine). It puts the
// "made it official" moment onto the same public feed as the daily check-ins, so a stranger reading
// the stamp address sees commitments and check-ins in one trail (Hendrik 2026-09-06).
//
// Runs inside the isolated `stakes-settle` tick (server/settle-due.ts) — the only process with the
// treasury key. The internet-facing API only ever QUEUES. Same guards as the seed pass: bounded
// attempts per row, and a treasury floor so this can never starve settlements. The recipient is
// STAKES_STAMP_ADDRESS; if it is unset the pass is a no-op (the feature stays dark, nothing breaks).

import { KeyPair } from '@nimiq/core'
import { broadcast, buildSignedNim } from './client.ts'
import { listPendingWordStamps, markWordStampFailed, markWordStampSent } from './db.ts'
import { getBalanceLuna, getBlockNumber } from './rpc.ts'
import { treasuryAddress } from './treasury.ts'
import { TREASURY_FLOOR_LUNA } from './seed-due.ts'
import { commitmentLine } from '../src/vault/payload.ts'

/** The published stamp address (the check-in feed). Same value as the client's VITE_STAMP_ADDRESS. */
export const stampAddress = () => (process.env.STAKES_STAMP_ADDRESS ?? '').trim()
/** One luna — the protocol minimum; the stamp's meaning is in its data, not its value. */
const DUST_LUNA = 1n

export interface WordDueOpts {
  execute?: boolean // default false → dry run: sign, log, send nothing
  kp: KeyPair
  height?: number // injectable (tests); defaults to getBlockNumber()
  balanceLuna?: bigint // injectable (tests); defaults to the live treasury balance
  log?: (msg: string) => void
}

export interface WordDueResult {
  planned: number
  sent: number
  failed: number
  skipped?: string
}

export async function wordDue(opts: WordDueOpts): Promise<WordDueResult> {
  const { execute = false, kp } = opts
  const log = opts.log ?? (() => {})
  const pending = listPendingWordStamps()
  if (pending.length === 0) return { planned: 0, sent: 0, failed: 0 }

  const STAMP_ADDRESS = stampAddress()
  if (!STAMP_ADDRESS) {
    const skipped = 'STAKES_STAMP_ADDRESS not set — commitment stamps paused'
    log(`[word] ${skipped}`)
    return { planned: pending.length, sent: 0, failed: 0, skipped }
  }

  const balance = opts.balanceLuna ?? BigInt(await getBalanceLuna(treasuryAddress(kp)))
  const need = BigInt(pending.length) * DUST_LUNA
  if (balance - need < TREASURY_FLOOR_LUNA) {
    const skipped = `treasury at floor (${balance} luna) — commitment stamps paused`
    log(`[word] ${skipped}`)
    return { planned: pending.length, sent: 0, failed: 0, skipped }
  }

  const height = opts.height ?? (await getBlockNumber())
  let sent = 0
  let failed = 0
  for (const row of pending) {
    try {
      const line = commitmentLine(row.challengeId, row.nim)
      const signed = buildSignedNim(kp, STAMP_ADDRESS, DUST_LUNA, height, line)
      if (!execute) {
        log(`[word] would send → ${STAMP_ADDRESS}  ${signed.hash}  [${line}]`)
        continue
      }
      const hash = await broadcast(signed)
      markWordStampSent(row.challengeId, hash)
      sent++
      log(`[word] sent → feed  ${hash}  [${line}]`)
    } catch (e) {
      failed++
      markWordStampFailed(row.challengeId, (e as Error).message)
      log(`[word] ✗ ${row.challengeId}: ${(e as Error).message}`)
    }
  }
  return { planned: pending.length, sent, failed }
}
