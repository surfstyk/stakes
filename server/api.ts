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
import { addCheckin, cheer, createChallenge, getChallenge, getSettlement, joinChallenge } from './db.ts'
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
        return view ? send(res, 200, view) : send(res, 404, { error: 'challenge not found' })
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
        return result ? send(res, 200, { ...result, challenge: getChallenge(id) }) : send(res, 404, { error: 'challenge not found' })
      }

      // POST /api/challenges/:id/join
      if (method === 'POST' && seg[3] === 'join' && seg.length === 4) {
        if (!getChallenge(id)) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        if (!address) return send(res, 400, { error: 'address required' })
        joinChallenge(id, { address, name: str(b.name) || 'You', depositTxHash: str(b.depositTxHash) || undefined })
        return send(res, 200, getChallenge(id))
      }

      // POST /api/challenges/:id/checkins
      if (method === 'POST' && seg[3] === 'checkins' && seg.length === 4) {
        if (!getChallenge(id)) return send(res, 404, { error: 'challenge not found' })
        const b = await readJson(req)
        const address = str(b.address)
        const day = num(b.day)
        const note = str(b.note)
        if (!address || !Number.isFinite(day) || (!note && !str(b.emoji))) {
          return send(res, 400, { error: 'address, day and a note or emoji required' })
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
