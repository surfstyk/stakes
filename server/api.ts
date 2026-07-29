// Stakes MVP API — plain node:http (no framework deps). Same-origin under /api
// (Vite proxy in dev, Caddy reverse_proxy in prod), so no CORS needed.
//
//   GET  /api/health
//   POST /api/challenges                              create → { id }
//   GET  /api/challenges/:id                          full view (+ participants, checkins)
//   POST /api/challenges/:id/join                     { address, name, depositTxHash? }
//   POST /api/challenges/:id/checkins                 { address, day, note, emoji? } → { id }
//   POST /api/challenges/:id/checkins/:cid/cheer
//   GET  /api/challenges/:id/settlement               computed payouts
//
// Writes are trust-on-use for the MVP (address in body); signMessage verification is a
// hardening fast-follow (see surfstyk-notes/MVP.md).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { openDay } from '../src/vault/schedule.ts'
import { addCheckin, cheer, createChallenge, getChallenge, getSettlement, getSettlementRecord, joinChallenge } from './db.ts'
import { normAddr } from './rpc.ts'
import { verifyChallenge } from './verify.ts'

const PORT = Number(process.env.STAKES_API_PORT ?? 8787)

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(json)
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1_000_000) reject(new Error('body too large'))
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const seg = url.pathname.split('/').filter(Boolean) // ['api','challenges',':id',...]
    const method = req.method ?? 'GET'

    if (seg[0] !== 'api') return send(res, 404, { error: 'not found' })

    // GET /api/health
    if (method === 'GET' && seg[1] === 'health' && seg.length === 2) {
      return send(res, 200, { ok: true })
    }

    // POST /api/challenges
    if (method === 'POST' && seg[1] === 'challenges' && seg.length === 2) {
      const b = await readJson(req)
      const goal = str(b.goal)
      const creatorAddress = str(b.creatorAddress)
      const durationDays = num(b.durationDays)
      const stake = num(b.stake)
      const windowMs = num(b.windowMs)
      const dayLengthMs = num(b.dayLengthMs)
      if (!goal || !creatorAddress || !Number.isFinite(durationDays) || !Number.isFinite(stake)) {
        return send(res, 400, { error: 'goal, creatorAddress, durationDays, stake required' })
      }
      // SEC-05: bound the numbers server-side (the client clamps, but the API is the trust
      // boundary). durationDays: 0 crashes settlement; negative/huge values corrupt the math.
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 60) {
        return send(res, 400, { error: 'durationDays must be a whole number between 1 and 60' })
      }
      if (!(stake > 0) || stake > 1_000_000) {
        return send(res, 400, { error: 'stake must be greater than 0 and at most 1000000' })
      }
      if (Number.isFinite(windowMs) && (windowMs < 0 || windowMs > 60 * 86400_000)) {
        return send(res, 400, { error: 'windowMs must be between 0 and 60 days' })
      }
      if (Number.isFinite(dayLengthMs) && (dayLengthMs <= 0 || dayLengthMs > 90 * 86400_000)) {
        return send(res, 400, { error: 'dayLengthMs must be between 0 and 90 days' })
      }
      const id = createChallenge({
        goal,
        emoji: str(b.emoji) || '🔥',
        durationDays,
        stake,
        asset: str(b.asset) || 'NIM',
        creatorAddress,
        creatorName: str(b.creatorName) || 'You',
        lockAt: Date.now() + (Number.isFinite(windowMs) ? windowMs : 24 * 3600_000),
        dayLengthMs: Number.isFinite(dayLengthMs) && dayLengthMs > 0 ? dayLengthMs : 24 * 3600_000,
      })
      return send(res, 201, { id })
    }

    // routes under /api/challenges/:id
    if (seg[1] === 'challenges' && seg[2]) {
      const id = seg[2]

      // GET /api/challenges/:id
      if (method === 'GET' && seg.length === 3) {
        const view = getChallenge(id)
        return view ? send(res, 200, publicChallenge(view)) : send(res, 404, { error: 'challenge not found' })
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

      // POST /api/challenges/:id/join
      if (method === 'POST' && seg[3] === 'join' && seg.length === 4) {
        if (!getChallenge(id)) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        if (!address) return send(res, 400, { error: 'address required' })
        joinChallenge(id, { address, name: str(b.name) || 'You', depositTxHash: str(b.depositTxHash) || undefined })
        return send(res, 200, publicChallenge(getChallenge(id)))
      }

      // POST /api/challenges/:id/checkins
      if (method === 'POST' && seg[3] === 'checkins' && seg.length === 4) {
        const view = getChallenge(id)
        if (!view) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        const day = num(b.day)
        const note = str(b.note)
        if (!address || !Number.isFinite(day) || (!note && !str(b.emoji))) {
          return send(res, 400, { error: 'address, day and a note or emoji required' })
        }
        // SEC-03: enforce the check-in window server-side — the browser's "closing door" is
        // not a trust boundary. Only a member can check in, and only for the day whose
        // window is open right now (no backfilling missed days, no pre-filling future ones).
        if (!view.participants.some((p) => normAddr(p.address) === normAddr(address))) {
          return send(res, 403, { error: 'not a participant in this challenge' })
        }
        const open = openDay(view, Date.now())
        if (open < 0) {
          return send(res, 409, { error: 'check-ins are closed (the challenge has not started or has ended)' })
        }
        if (day !== open) {
          return send(res, 409, { error: `only today's check-in (day ${open + 1}) is open` })
        }
        const checkinId = addCheckin(id, { address, day, note, emoji: str(b.emoji) || undefined })
        return send(res, 201, { id: checkinId })
      }

      // POST /api/challenges/:id/checkins/:cid/cheer
      if (method === 'POST' && seg[3] === 'checkins' && seg[4] && seg[5] === 'cheer') {
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
