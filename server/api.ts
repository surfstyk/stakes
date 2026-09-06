// Stakes MVP API — plain node:http (no framework deps). Same-origin under /api
// (Vite proxy in dev, Caddy reverse_proxy in prod), so no CORS needed.
//
//   GET  /api/health
//   POST /api/challenges                              create → { id }
//   GET  /api/challenges/:id                          full view (+ participants, checkins)
//   POST /api/challenges/:id/official                 { address, durationDays, stake, depositTxHash }
//   POST /api/challenges/:id/checkins                 { address, day, stampTxHash? }
//   GET  /api/challenges/:id/settlement               computed payouts
//   POST /api/seed                                    { address, challengeId } → queue the silent sliver
//   POST /api/challenges/:id/join · …/checkins/:cid/cheer   crew mode — OFF unless STAKES_CREW=1
//
// Writes carry the wallet address in the body and are not signed (SEC-04). What keeps that safe:
// money only ever moves to a wallet's own confirmed on-chain deposit, and the two writes that could
// lock a wallet out are self-defending — /official requires the deposit to be visible on-chain
// (tagged for this exact run, unused, at least the minimum stake), and a new taste replaces a
// never-staked one instead of being blocked by it. Full signMessage auth is post-competition.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { openDay } from '../src/vault/schedule.ts'
import {
  addCheckin,
  archiveChallenge,
  cheer,
  confirmDeposit,
  countActiveFor,
  countSeedsSince,
  createChallenge,
  deleteWindowChallenge,
  getActiveRowFor,
  getChallenge,
  getHistoryRowsFor,
  getSeed,
  getSettlement,
  getSettlementRecord,
  isDepositHashUsed,
  joinChallenge,
  keptDaysFor,
  requestSeed,
  reshapeCheckinsFor,
  setOfficial,
  statsStartedThisWeek,
  type ChallengeRow,
} from './db.ts'
import { HASH_RE, lookupStakeDeposit, normAddr } from './rpc.ts'
import { verifyChallenge } from './verify.ts'

const GRACE_MS = 15 * 60_000
const WEEK_MS = 7 * 86400_000
const DAY_MS = 24 * 3600_000
const LUNA_PER_NIM = 100_000
// Real-money deployment iff a treasury is configured (mirrors server/verify.ts + the client
// invariant "mock money ⟺ mock build"). Read at call time so the real-money paths are testable.
const treasuryAddr = () => (process.env.STAKES_TREASURY_ADDRESS ?? process.env.VITE_TREASURY_NIM_ADDRESS ?? '').trim()
const realMoney = () => Boolean(treasuryAddr())
// The UI's smallest stake is 50 NIM/day × 1 day. Enforced server-side on real money so a stranger
// who wants to register a run under someone else's address has to fund it with at least this much
// of their own NIM — which the run's owner then receives at settlement.
const minStakeNim = () => Number(process.env.STAKES_MIN_STAKE_NIM ?? 50)
// Crew mode (join / cheer) is off for the solo-first Cycle II — dead surface stays closed.
const CREW = process.env.STAKES_CREW === '1'

/** Chain access for /official, swappable in tests (the retry cadence too). */
export const chainDeps = { lookupStakeDeposit, retryDelayMs: 1250, attempts: 8 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Find a reported deposit on-chain, retrying briefly — the wallet returns before inclusion. */
async function findDeposit(treasury: string, challengeId: string, hash: string) {
  for (let i = 0; i < chainDeps.attempts; i++) {
    if (i > 0) await sleep(chainDeps.retryDelayMs)
    try {
      const d = await chainDeps.lookupStakeDeposit(treasury, challengeId, hash)
      if (d) return d
    } catch (e) {
      console.warn('official: deposit lookup failed —', (e as Error).message)
    }
  }
  return null
}

// ---- reshape serialization (Cycle II) — the shapes src/reshape/model.ts reads --------------
function reshapeChallenge(row: ChallengeRow) {
  return {
    id: row.id,
    templateId: row.templateId ?? row.id,
    goal: row.goal,
    emoji: row.emoji,
    status: row.status,
    creatorAddress: row.creatorAddress,
    createdAt: row.createdAt,
    lockAt: row.lockAt,
    dayLengthMs: row.dayLengthMs,
    durationDays: row.durationDays,
    stake: row.stake,
    asset: row.asset,
    stakedAt: row.stakedAt,
    seq: row.seq,
    checkins: reshapeCheckinsFor(row.id, row.creatorAddress),
  }
}
function outcomeFor(row: ChallengeRow): 'banked' | 'partial' | 'wipeout' | 'lapsed' {
  if (row.status === 'lapsed') return 'lapsed'
  const kept = keptDaysFor(row.id, row.creatorAddress)
  if (kept >= row.durationDays) return 'banked'
  if (kept <= 0) return 'wipeout'
  return 'partial'
}
function historyItem(row: ChallengeRow) {
  return {
    id: row.id,
    templateId: row.templateId ?? row.id,
    goal: row.goal,
    emoji: row.emoji,
    outcome: outcomeFor(row),
    kept: keptDaysFor(row.id, row.creatorAddress),
    total: row.durationDays,
    stake: row.stake,
    endedAt: row.endedAt ?? row.createdAt,
  }
}
/** A run that has come to rest on the server clock: a lapsed taste or an over run. Else null. */
function computeTerminal(row: ChallengeRow, now: number): 'lapsed' | 'ended' | null {
  if (row.status === 'window') return !row.stakedAt && now >= row.lockAt + row.dayLengthMs ? 'lapsed' : null
  if (row.status === 'official') {
    const kept = keptDaysFor(row.id, row.creatorAddress)
    return now >= row.lockAt + row.durationDays * row.dayLengthMs || kept >= row.durationDays ? 'ended' : null
  }
  return null
}

const PORT = Number(process.env.STAKES_API_PORT ?? 8787)

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(json)
}

// Every legitimate body is < 1 KB. Past the cap the socket is DESTROYED, not just rejected —
// otherwise the handler keeps buffering whatever the client streams until it hangs up (audit M3).
const MAX_BODY_BYTES = 64 * 1024
function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    let overflow = false
    req.on('data', (c) => {
      if (overflow) return
      raw += c
      if (raw.length > MAX_BODY_BYTES) {
        overflow = true
        raw = ''
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)

// ---- the seed faucet (ONBOARDING.md §7.5 abuse box) ----------------------------------------
// One seed per wallet, a per-requester daily limit, a global daily cap, a kill switch. The API
// only QUEUES; the isolated settle service signs + sends (server/seed-due.ts).
const SEED_LUNA = Number(process.env.STAKES_SEED_LUNA ?? 10_000) // 0.1 NIM ≈ a month of dust stamps
const SEED_DAILY_CAP = Number(process.env.STAKES_SEED_DAILY_CAP ?? 500)
const SEED_PER_IP_DAILY = Number(process.env.STAKES_SEED_PER_IP_DAILY ?? 20)
const SEED_OFF = process.env.STAKES_SEED_OFF === '1'
const DAY = 86400_000
// Nimiq user-friendly address: NQ + 2 check digits + 32 base32 chars (0-9 A-H J-N P-V X Y).
const NQ_RE = /^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/
const normNq = (s: string) => s.replace(/\s+/g, '').toUpperCase()
const prettyNq = (s: string) => normNq(s).replace(/(.{4})(?=.)/g, '$1 ')
// Requester fingerprint: hashed first-hop IP (Caddy sets X-Forwarded-For); never stored raw.
function requesterHash(req: IncomingMessage): string {
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  const ip = xff || req.socket.remoteAddress || '?'
  return createHash('sha256').update(`stakes-seed:${ip}`).digest('hex').slice(0, 16)
}

// Public serialization of a challenge view. Strips server-internal deposit fields
// (depositTxHash, depositConfirmed): the UI never reads them, and exposing a participant's
// depositTxHash let another participant claim that on-chain deposit as their own
// (SEC-06 → SEC-01). Verify/settle read these straight from the DB, not the wire.
// Public settlement state for the results receipt: whether payouts have landed, and the
// on-chain txs (all public info — amounts/addresses/hashes are visible on-chain anyway).
// The hex-serialized tx bodies are stripped; failures aren't surfaced (they just retry).
function settlementView(id: string) {
  const rec = getSettlementRecord(id)
  if (!rec || rec.status === 'failed') return null
  let txs: { kind: string; to: string; nim: number; hash: string }[] = []
  try {
    txs = (JSON.parse(rec.sent ?? rec.plan ?? '[]') as { kind: string; to: string; nim: number; hash: string }[]).map(
      (t) => ({ kind: t.kind, to: t.to, nim: t.nim, hash: t.hash }),
    )
  } catch {
    txs = []
  }
  return { status: rec.status, at: rec.at, txs }
}

function publicChallenge(view: ReturnType<typeof getChallenge>) {
  if (!view) return view
  return {
    ...view,
    participants: view.participants.map(({ depositTxHash, depositConfirmed, ...rest }) => rest),
    settlement: settlementView(view.id),
  }
}

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const seg = url.pathname.split('/').filter(Boolean) // ['api','challenges',':id',...]
    const method = req.method ?? 'GET'

    if (seg[0] !== 'api') return send(res, 404, { error: 'not found' })

    // GET /api/health
    if (method === 'GET' && seg[1] === 'health' && seg.length === 2) {
      return send(res, 200, { ok: true })
    }

    // GET /api/me?address=  → the landing read: { active, history }
    if (method === 'GET' && seg[1] === 'me' && seg.length === 2) {
      const address = str(url.searchParams.get('address'))
      if (!address) return send(res, 400, { error: 'address required' })
      const activeRow = getActiveRowFor(address)
      return send(res, 200, {
        active: activeRow ? reshapeChallenge(activeRow) : null,
        history: getHistoryRowsFor(address).map(historyItem),
      })
    }

    // POST /api/me/archive  { address } → retire a finished/lapsed run into history
    if (method === 'POST' && seg[1] === 'me' && seg[2] === 'archive' && seg.length === 3) {
      const b = await readJson(req)
      const address = str(b.address)
      if (!address) return send(res, 400, { error: 'address required' })
      const active = getActiveRowFor(address)
      if (active) {
        const term = computeTerminal(active, Date.now())
        if (term) archiveChallenge(active.id, term)
      }
      return send(res, 200, { ok: true })
    }

    // GET /api/stats/social → the deck's honest counters (never invented)
    if (method === 'GET' && seg[1] === 'stats' && seg[2] === 'social' && seg.length === 3) {
      return send(res, 200, { startedThisWeek: statsStartedThisWeek(Date.now() - WEEK_MS) })
    }

    // POST /api/challenges  { templateId, goal, emoji, creatorAddress } → start a taste (window)
    if (method === 'POST' && seg[1] === 'challenges' && seg.length === 2) {
      const b = await readJson(req)
      const goal = str(b.goal)
      const creatorAddress = str(b.creatorAddress)
      if (!goal || !creatorAddress) return send(res, 400, { error: 'goal and creatorAddress required' })
      // The invariant, enforced at the API (the trust boundary): ≤1 live run per address.
      // A finished/lapsed run is retired first. A never-staked taste is REPLACED, not a blocker:
      // it holds no money and no progress, and writes aren't signed (SEC-04) — if it could block,
      // one unauthenticated POST under someone else's address would lock them out for a day.
      // Only a staked (official) run still blocks a new start.
      const existing = getActiveRowFor(creatorAddress)
      if (existing) {
        const term = computeTerminal(existing, Date.now())
        if (term) archiveChallenge(existing.id, term)
        else if (existing.status === 'window' && !existing.stakedAt && deleteWindowChallenge(existing.id)) {
          /* replaced */
        } else return send(res, 409, { error: 'you already have a challenge running' })
      }
      // The compressed "fast clock" is a dev/testnet affordance only (the client strips it from
      // the public build; see src/lib/flags.ts DEV_TOOLS). On a real-money deployment every run
      // uses a true 24h day: an attacker-chosen tiny dayLengthMs would let a "7-day" challenge
      // complete in seconds and race settlement (bonus-farming / rapid payout loops). If an
      // insider fast clock is ever needed on the live box, gate it behind a server-side secret,
      // never an open request field.
      const dl = num(b.dayLengthMs)
      const dayLengthMs = !realMoney() && Number.isFinite(dl) && dl > 0 && dl <= 90 * 86400_000 ? dl : DAY_MS
      createChallenge({
        goal,
        emoji: str(b.emoji) || '🔥',
        durationDays: 0,
        stake: 0,
        asset: 'NIM',
        creatorAddress,
        creatorName: str(b.creatorName) || 'You',
        lockAt: Date.now(),
        dayLengthMs,
        status: 'window',
        templateId: str(b.templateId) || undefined,
      })
      return send(res, 201, reshapeChallenge(getActiveRowFor(creatorAddress)!))
    }

    // POST /api/seed  { address, challengeId }
    if (method === 'POST' && seg[1] === 'seed' && seg.length === 2) {
      const b = await readJson(req)
      const address = str(b.address)
      const challengeId = str(b.challengeId)
      if (!NQ_RE.test(normNq(address))) return send(res, 400, { error: 'a Nimiq address is required' })
      if (!challengeId || !getChallenge(challengeId)) return send(res, 404, { error: 'challenge not found' })
      const addr = prettyNq(address)
      const existing = getSeed(addr, challengeId)
      if (existing) return send(res, 200, { status: 'exists', seeded: existing.status === 'sent' })
      if (SEED_OFF) return send(res, 503, { error: 'seeding is paused' })
      const since = Date.now() - DAY
      if (countSeedsSince(since) >= SEED_DAILY_CAP) return send(res, 429, { error: 'seed cap reached for today' })
      const who = requesterHash(req)
      if (countSeedsSince(since, who) >= SEED_PER_IP_DAILY) return send(res, 429, { error: 'too many seeds from this network today' })
      const status = requestSeed({ address: addr, challengeId, ipHash: who, luna: SEED_LUNA })
      return send(res, 200, { status, seeded: false })
    }

    // routes under /api/challenges/:id
    if (seg[1] === 'challenges' && seg[2]) {
      const id = seg[2]

      // GET /api/challenges/:id
      if (method === 'GET' && seg.length === 3) {
        const view = getChallenge(id)
        return view ? send(res, 200, publicChallenge(view)) : send(res, 404, { error: 'challenge not found' })
      }

      // DELETE /api/challenges/:id — the mis-tap exit: drop a never-staked taste (J4)
      if (method === 'DELETE' && seg.length === 3) {
        return send(res, 200, { deleted: deleteWindowChallenge(id) })
      }

      // POST /api/challenges/:id/official  { address, durationDays, stake, depositTxHash }
      if (method === 'POST' && seg[3] === 'official' && seg.length === 4) {
        const view = getChallenge(id)
        if (!view) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        const durationDays = num(b.durationDays)
        const stake = num(b.stake)
        if (!address) return send(res, 400, { error: 'address required' })
        if (normAddr(address) !== normAddr(view.creatorAddress)) return send(res, 403, { error: 'not your challenge' })
        // Idempotent for the creator (audit M1): the wallet deposits BEFORE this POST, so a retry
        // after a lost response must return the run, never 409 — a 409 reads as failure and invites
        // a second real deposit. A retried deposit hash is kept if the first POST carried none.
        if (view.status === 'official' && view.participants.some((p) => normAddr(p.address) === normAddr(address))) {
          const hash = str(b.depositTxHash)
          if (hash) joinChallenge(id, { address: view.participants.find((p) => normAddr(p.address) === normAddr(address))!.address, name: view.creatorName, depositTxHash: hash })
          return send(res, 200, reshapeChallenge(getActiveRowFor(view.creatorAddress)!))
        }
        if (view.status !== 'window') return send(res, 409, { error: 'this challenge is not a taste anymore' })
        // SEC-05: bound the numbers server-side (the API is the trust boundary).
        if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 60) return send(res, 400, { error: 'durationDays must be a whole number between 1 and 60' })
        if (!(stake > 0) || stake > 1_000_000) return send(res, 400, { error: 'stake must be greater than 0 and at most 1000000' })
        let depositTxHash = str(b.depositTxHash) || undefined
        if (realMoney()) {
          // Self-authenticating on real money (SEC-04 mitigation): the run goes official only
          // against a deposit that is actually on-chain, tagged `official:<this id>`, of the stated
          // amount, and not already backing anyone. Nothing here trusts the body beyond what the
          // chain confirms. (The sender is NOT matched to the address: Nimiq Pay pays from a
          // sub-address that differs from its listAccounts identity — verified on mainnet.)
          if (stake < minStakeNim()) return send(res, 400, { error: `stake must be at least ${minStakeNim()} NIM` })
          const hash = (depositTxHash ?? '').toLowerCase()
          if (!HASH_RE.test(hash)) return send(res, 402, { error: 'a deposit transaction is required to make it official' })
          if (isDepositHashUsed(hash)) return send(res, 409, { error: 'that deposit is already registered' })
          const d = await findDeposit(treasuryAddr(), id, hash)
          if (!d) return send(res, 402, { error: 'deposit not found on-chain yet — retrying is safe' })
          if (Math.abs(d.valueLuna - Math.round(stake * LUNA_PER_NIM)) > 1) return send(res, 400, { error: 'the deposit amount does not match the stake' })
          depositTxHash = d.hash.toLowerCase()
        }
        setOfficial(id, { durationDays, stake, stakedAt: Date.now() })
        // the solo player becomes the sole participant, with their tagged deposit (official:<id>)
        joinChallenge(id, { address: view.creatorAddress, name: view.creatorName, depositTxHash })
        if (realMoney()) confirmDeposit(id, view.creatorAddress, depositTxHash ?? null, true)
        return send(res, 200, reshapeChallenge(getActiveRowFor(view.creatorAddress)!))
      }

      // GET /api/challenges/:id/settlement (verify deposits first → count confirmed only)
      if (method === 'GET' && seg[3] === 'settlement' && seg.length === 4) {
        if (!(await verifyChallenge(id))) return send(res, 404, { error: 'challenge not found' })
        const s = getSettlement(id)
        return s ? send(res, 200, s) : send(res, 404, { error: 'challenge not found' })
      }

      // POST /api/challenges/:id/verify (confirm stake deposits landed on-chain)
      if (method === 'POST' && seg[3] === 'verify' && seg.length === 4) {
        const result = await verifyChallenge(id)
        return result ? send(res, 200, { ...result, challenge: publicChallenge(getChallenge(id)) }) : send(res, 404, { error: 'challenge not found' })
      }

      // POST /api/challenges/:id/join — crew mode, off for solo-first Cycle II
      if (method === 'POST' && seg[3] === 'join' && seg.length === 4) {
        if (!CREW) return send(res, 410, { error: 'joining a challenge is not available' })
        if (!getChallenge(id)) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        if (!address) return send(res, 400, { error: 'address required' })
        joinChallenge(id, { address, name: str(b.name) || 'You', depositTxHash: str(b.depositTxHash) || undefined })
        return send(res, 200, publicChallenge(getChallenge(id)))
      }

      // POST /api/challenges/:id/checkins  { address, day, stampTxHash? } — the solo seal
      if (method === 'POST' && seg[3] === 'checkins' && seg.length === 4) {
        const view = getChallenge(id)
        if (!view) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        const day = num(b.day)
        if (!address || !Number.isFinite(day)) return send(res, 400, { error: 'address and day required' })
        if (view.status !== 'official') return send(res, 409, { error: 'the run is not staked yet' })
        // SEC-03: only a member checks in, only for the open day (no backfilling / pre-filling).
        if (!view.participants.some((p) => normAddr(p.address) === normAddr(address))) {
          return send(res, 403, { error: 'not a participant in this challenge' })
        }
        const now = Date.now()
        const open = openDay(view, now)
        // day-one grace (J4): a deposit that lands just as day 0 closes still gets to seal day 0
        // until stakedAt + 15 min. Only for day 0, only if unsealed, only while day 1 is current.
        const alreadyDay0 = view.checkins.some((k) => normAddr(k.address) === normAddr(address) && k.day === 0)
        const graceDay0 = view.stakedAt != null && day === 0 && open === 1 && !alreadyDay0 && now <= view.stakedAt + GRACE_MS
        if (open < 0 && !graceDay0) return send(res, 409, { error: 'check-ins are closed (the challenge has not started or has ended)' })
        if (day !== open && !graceDay0) return send(res, 409, { error: `only today's check-in (day ${open + 1}) is open` })
        // idempotent per day (a re-tapped seal is a no-op, not a duplicate row)
        if (!view.checkins.some((k) => normAddr(k.address) === normAddr(address) && k.day === day)) {
          const stampTxHash = str(b.stampTxHash) || undefined
          addCheckin(id, { address, day, note: '', stampTxHash: stampTxHash ?? null, stampStatus: stampTxHash ? 'landed' : 'declined' })
        }
        return send(res, 200, reshapeChallenge(getActiveRowFor(address)!))
      }

      // POST /api/challenges/:id/checkins/:cid/cheer — crew mode, off for solo-first Cycle II
      if (method === 'POST' && seg[3] === 'checkins' && seg[4] && seg[5] === 'cheer') {
        if (!CREW) return send(res, 410, { error: 'cheering is not available' })
        cheer(seg[4])
        return send(res, 200, { ok: true })
      }
    }

    return send(res, 404, { error: 'not found' })
  } catch (e) {
    return send(res, 400, { error: (e as Error).message || 'bad request' })
  }
})

// Bind to loopback by default: in prod the service sits behind Caddy (reverse_proxy
// localhost:PORT) and must NOT be reachable directly from the internet. The Vite dev
// proxy also targets localhost, so this is correct in dev too. Override with
// STAKES_API_HOST=0.0.0.0 only if you knowingly need to expose it.
const HOST = process.env.STAKES_API_HOST ?? '127.0.0.1'

server.listen(PORT, HOST, () => {
  console.log(`Stakes API on http://${HOST}:${PORT}  (db: ${process.env.STAKES_DB ?? 'server/stakes.db'})`)
})
