// Tests for the Cycle-II reshape server (BUILD-HANDOFF §7): the lifecycle db functions AND
// the HTTP endpoints. The HTTP half matters because server/*.ts is NOT covered by `tsc`
// (tsconfig includes only src/) — a wiring bug in api.ts would otherwise reach production.
//
// All offline: an isolated temp DB, the API bound to a random loopback port, no chain calls.

import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

const dir = mkdtempSync(join(tmpdir(), 'stakes-reshape-'))
process.env.STAKES_DB = join(dir, 'test.db')
process.env.STAKES_API_PORT = '0' // random free port

const db = await import('./db.ts')
const { server, chainDeps } = await import('./api.ts')

let base = ''
before(async () => {
  if (!server.listening) await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => {
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

const j = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + '/api' + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : undefined }
}

const NQ = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

// ---- db-level lifecycle -----------------------------------------------------

test('createChallenge defaults to a window (taste) with a display Nº and no stake', () => {
  const id = db.createChallenge({
    goal: 'going sugar-free', emoji: '🍩', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: 'DB-A', creatorName: 'You', lockAt: Date.now(), dayLengthMs: 86400000, templateId: 'sugar',
  })
  const row = db.getActiveRowFor('DB-A')!
  assert.equal(row.id, id)
  assert.equal(row.status, 'window')
  assert.equal(row.templateId, 'sugar')
  assert.equal(row.stake, 0)
  assert.ok(row.seq > 0, 'a Nº was assigned')
})

test('setOfficial stakes the taste; addCheckin stamps; keptDays counts distinct days', () => {
  const id = db.createChallenge({
    goal: 'run', emoji: '🏃', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: 'DB-B', creatorName: 'You', lockAt: Date.now(), dayLengthMs: 86400000, templateId: 'run',
  })
  db.setOfficial(id, { durationDays: 7, stake: 70, stakedAt: Date.now() })
  db.joinChallenge(id, { address: 'DB-B', name: 'You', depositTxHash: 'mock-DB-B' })
  db.addCheckin(id, { address: 'DB-B', day: 0, note: '', stampTxHash: '0xabc', stampStatus: 'landed' })
  db.addCheckin(id, { address: 'DB-B', day: 1, note: '', stampTxHash: null, stampStatus: 'declined' })
  const row = db.getActiveRowFor('DB-B')!
  assert.equal(row.status, 'official')
  assert.equal(row.stake, 70)
  assert.equal(row.durationDays, 7)
  assert.equal(db.keptDaysFor(id, 'DB-B'), 2)
  const marks = db.reshapeCheckinsFor(id, 'DB-B')
  assert.equal(marks[0].stampTxHash, '0xabc')
  assert.equal(marks[1].stampStatus, 'declined')
})

test('archiveChallenge moves a run out of active into history', () => {
  const id = db.createChallenge({
    goal: 'read', emoji: '📚', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: 'DB-C', creatorName: 'You', lockAt: Date.now(), dayLengthMs: 86400000, templateId: 'read',
  })
  db.setOfficial(id, { durationDays: 7, stake: 70, stakedAt: Date.now() })
  assert.equal(db.countActiveFor('DB-C'), 1)
  db.archiveChallenge(id, 'ended')
  assert.equal(db.countActiveFor('DB-C'), 0)
  assert.equal(db.getActiveRowFor('DB-C'), undefined)
  const hist = db.getHistoryRowsFor('DB-C')
  assert.equal(hist.length, 1)
  assert.equal(hist[0].id, id)
})

test('deleteWindowChallenge drops a never-staked taste, but not a staked run', () => {
  const idW = db.createChallenge({
    goal: 'meditate', emoji: '🧘', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: 'DB-D', creatorName: 'You', lockAt: Date.now(), dayLengthMs: 86400000, templateId: 'meditate',
  })
  assert.equal(db.deleteWindowChallenge(idW), true)
  assert.equal(db.getActiveRowFor('DB-D'), undefined)

  const idO = db.createChallenge({
    goal: 'meditate', emoji: '🧘', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: 'DB-E', creatorName: 'You', lockAt: Date.now(), dayLengthMs: 86400000, templateId: 'meditate',
  })
  db.setOfficial(idO, { durationDays: 7, stake: 70, stakedAt: Date.now() })
  db.joinChallenge(idO, { address: 'DB-E', name: 'You', depositTxHash: 'mock-DB-E' })
  assert.equal(db.deleteWindowChallenge(idO), false, 'a staked run is never deleted this way')
})

// ---- HTTP endpoints (the wiring `tsc` does not cover) ------------------------

test('POST /challenges starts a taste; a second start REPLACES a never-staked taste; a staked run blocks', async () => {
  const before = (await j('GET', '/stats/social')).body.startedThisWeek as Record<string, number>
  const a = await j('POST', '/challenges', { templateId: 'sugar', goal: 'going sugar-free', emoji: '🍩', creatorAddress: NQ })
  assert.equal(a.status, 201)
  assert.equal(a.body.status, 'window')
  assert.equal(a.body.templateId, 'sugar')
  assert.equal(a.body.durationDays, 0)

  // SEC-04 mitigation: a taste holds no money and no progress, so it never blocks its owner
  const again = await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: NQ })
  assert.equal(again.status, 201, 'a never-staked taste is replaced, not a blocker')
  assert.notEqual(again.body.id, a.body.id)
  assert.equal((await j('GET', `/challenges/${a.body.id}`)).status, 404, 'the replaced taste is gone')
  const social = (await j('GET', '/stats/social')).body.startedThisWeek as Record<string, number>
  assert.equal(social.sugar ?? 0, before.sugar ?? 0, 'the replaced taste no longer counts as started')
  assert.equal(social.run ?? 0, (before.run ?? 0) + 1, 'the replacement counts once')

  await j('POST', `/challenges/${again.body.id}/official`, { address: NQ, durationDays: 7, stake: 70, depositTxHash: 'mock-blk' })
  const blocked = await j('POST', '/challenges', { templateId: 'sugar', goal: 'sugar', emoji: '🍩', creatorAddress: NQ })
  assert.equal(blocked.status, 409, 'a staked run still blocks a second start')
})

test('the full happy path over HTTP: taste → official → seal → /me', async () => {
  const addr = 'NQ11 1111 1111 1111 1111 1111 1111 1111 1111'
  const start = await j('POST', '/challenges', { templateId: 'run', goal: 'running every day', emoji: '🏃', creatorAddress: addr })
  const id = start.body.id

  const off = await j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 70, depositTxHash: 'mock-http' })
  assert.equal(off.status, 200)
  assert.equal(off.body.status, 'official')
  assert.equal(off.body.stake, 70)
  assert.ok(off.body.stakedAt > 0, 'the deposit moment was recorded')

  const seal = await j('POST', `/challenges/${id}/checkins`, { address: addr, day: 0, stampTxHash: '0xdeadbeef' })
  assert.equal(seal.status, 200)
  assert.equal(seal.body.checkins.length, 1)
  assert.equal(seal.body.checkins[0].stampTxHash, '0xdeadbeef')
  assert.equal(seal.body.checkins[0].stampStatus, 'landed')

  // re-sealing the same day is idempotent (no duplicate row)
  const again = await j('POST', `/challenges/${id}/checkins`, { address: addr, day: 0, stampTxHash: '0xother' })
  assert.equal(again.body.checkins.length, 1, 'a re-tapped seal is a no-op')

  const me = await j('GET', `/me?address=${encodeURIComponent(addr)}`)
  assert.equal(me.status, 200)
  assert.equal(me.body.active.id, id)
  assert.equal(me.body.active.checkins.length, 1)
  assert.equal(me.body.history.length, 0)
})

test('a check-in for a future day is rejected (the closing door, server-side)', async () => {
  const addr = 'NQ22 2222 2222 2222 2222 2222 2222 2222 2222'
  const start = await j('POST', '/challenges', { templateId: 'sugar', goal: 'going sugar-free', emoji: '🍩', creatorAddress: addr })
  const id = start.body.id
  await j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 70, depositTxHash: 'mock-f' })
  const bad = await j('POST', `/challenges/${id}/checkins`, { address: addr, day: 3 })
  assert.equal(bad.status, 409, 'only today’s check-in is open')
})

test('a taste past its window with no stake lapses; /me/archive retires it to history', async () => {
  const addr = 'NQ33 3333 3333 3333 3333 3333 3333 3333 3333'
  // a 50ms "day" so the taste window closes almost immediately
  const start = await j('POST', '/challenges', { templateId: 'meditate', goal: 'meditating', emoji: '🧘', creatorAddress: addr, dayLengthMs: 50 })
  assert.equal(start.status, 201)
  await new Promise((r) => setTimeout(r, 120))
  const arch = await j('POST', '/me/archive', { address: addr })
  assert.equal(arch.status, 200)
  const me = await j('GET', `/me?address=${encodeURIComponent(addr)}`)
  assert.equal(me.body.active, null, 'the lapsed taste is no longer active')
  assert.equal(me.body.history.length, 1)
  assert.equal(me.body.history[0].outcome, 'lapsed')
})

test('DELETE /challenges/:id drops a never-staked taste', async () => {
  const addr = 'NQ44 4444 4444 4444 4444 4444 4444 4444 4444'
  const start = await j('POST', '/challenges', { templateId: 'cold', goal: 'cold shower', emoji: '🚿', creatorAddress: addr })
  const del = await j('DELETE', `/challenges/${start.body.id}`)
  assert.equal(del.status, 200)
  assert.equal(del.body.deleted, true)
  const me = await j('GET', `/me?address=${encodeURIComponent(addr)}`)
  assert.equal(me.body.active, null)
})

test('GET /stats/social counts started-this-week by template, and never invents', async () => {
  const s = await j('GET', '/stats/social')
  assert.equal(s.status, 200)
  assert.ok(typeof s.body.startedThisWeek === 'object')
  // the sugar/run/meditate/cold tastes started above are counted honestly
  assert.ok((s.body.startedThisWeek.sugar ?? 0) >= 1)
})

// ---- audit M1: /official is idempotent for the creator (a retry after a lost response must
// return the run, not 409 — a 409 reads as failure and invites a second real deposit) ----

test('M1: a second POST /official from the creator returns the run (200), not 409', async () => {
  const addr = 'NQ55 5555 5555 5555 5555 5555 5555 5555 5555'
  const start = await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr })
  const id = start.body.id
  const first = await j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 70, depositTxHash: 'mock-a' })
  assert.equal(first.status, 200)
  const retry = await j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 70, depositTxHash: 'mock-a' })
  assert.equal(retry.status, 200, 'idempotent for the creator')
  assert.equal(retry.body.id, id)
  assert.equal(retry.body.status, 'official')
  assert.equal(retry.body.stake, 70, 'the original stake stands; a retry cannot re-parameterize the run')
  const stranger = await j('POST', `/challenges/${id}/official`, { address: NQ, durationDays: 7, stake: 70 })
  assert.equal(stranger.status, 403, 'still not anyone else\'s to touch')
})

// ---- audit M3: an oversized body is cut off, not buffered until the client hangs up ----

test('M3: a body past the cap is refused and the socket is closed', async () => {
  const big = JSON.stringify({ goal: 'x'.repeat(200_000), creatorAddress: NQ })
  let status: number | 'reset' = 'reset'
  try {
    const res = await fetch(base + '/api/challenges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: big })
    status = res.status
  } catch {
    status = 'reset' // connection destroyed mid-upload — also the intended outcome
  }
  assert.ok(status === 'reset' || status === 400, `oversized body refused (got ${status})`)
  const me = await j('GET', `/me?address=${encodeURIComponent(NQ)}`)
  assert.equal(me.status, 200, 'the API is still up afterwards')
})


// ---- crew mode is OFF for solo-first Cycle II (Hendrik, 2026-09-03): dead surface stays closed ----

test('crew off: POST /join and /cheer answer 410', async () => {
  const addr = 'NQ66 6666 6666 6666 6666 6666 6666 6666 6666'
  const start = await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr })
  const join = await j('POST', `/challenges/${start.body.id}/join`, { address: NQ, name: 'Stranger' })
  assert.equal(join.status, 410)
  assert.equal((await j('GET', `/challenges/${start.body.id}`)).body.participants.length, 0, 'nobody was attached')
  const cheer = await j('POST', `/challenges/${start.body.id}/checkins/whatever/cheer`)
  assert.equal(cheer.status, 410)
})

// ---- SEC-04 mitigation: on real money /official is self-authenticating — the run goes official
// only against a deposit that is on-chain, tagged for THIS run, of the stated amount, unused ----

const TREASURY = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const HASH_A = 'ab26a26b433509a034a4ca8ef531ee467321910a1a8412577d1de1637499e3b5'
const HASH_B = 'bb26a26b433509a034a4ca8ef531ee467321910a1a8412577d1de1637499e3b5'
async function realMoney<T>(chain: (treasury: string, id: string, hash: string) => Promise<{ from: string; valueLuna: number; hash: string; at: number } | null>, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.STAKES_TREASURY_ADDRESS
  const saved = { ...chainDeps }
  process.env.STAKES_TREASURY_ADDRESS = TREASURY
  chainDeps.lookupStakeDeposit = chain
  chainDeps.retryDelayMs = 1
  chainDeps.attempts = 2
  try {
    return await fn()
  } finally {
    if (prev === undefined) delete process.env.STAKES_TREASURY_ADDRESS
    else process.env.STAKES_TREASURY_ADDRESS = prev
    Object.assign(chainDeps, saved)
  }
}
const depositOf = (_id: string, hash: string, nim: number) => ({ from: 'NQ15 PG6C SOME SUB ADDR', valueLuna: nim * 100_000, hash, at: 1 })

test('real money: /official without a deposit hash is refused (402) and the run stays a taste', async () => {
  const addr = 'NQ77 7777 7777 7777 7777 7777 7777 7777 7777'
  const start = await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr })
  const id = start.body.id
  const r = await realMoney(async () => null, () => j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 60, stake: 100 }))
  assert.equal(r.status, 402)
  const me = await j('GET', `/me?address=${encodeURIComponent(addr)}`)
  assert.equal(me.body.active.status, 'window', 'nobody can flip a run official without a deposit → no lockout')
  assert.equal(me.body.active.durationDays, 0)
})

test('real money: a hash the chain does not know is refused (402, retried briefly)', async () => {
  const addr = 'NQ88 8888 8888 8888 8888 8888 8888 8888 8888'
  const id = (await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr })).body.id
  let calls = 0
  const r = await realMoney(async () => { calls++; return null }, () => j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 100, depositTxHash: HASH_A }))
  assert.equal(r.status, 402)
  assert.equal(calls, 2, 'looked up again after a short wait (inclusion lag)')
})

test('real money: a deposit of the wrong amount, or below the minimum stake, is refused', async () => {
  const addr = 'NQ99 9999 9999 9999 9999 9999 9999 9999 9999'
  const id = (await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr })).body.id
  const wrong = await realMoney(async (_t, cid, h) => depositOf(cid, h, 1), () => j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 100, depositTxHash: HASH_A }))
  assert.equal(wrong.status, 400)
  assert.match(wrong.body.error, /amount/)
  const tiny = await realMoney(async (_t, cid, h) => depositOf(cid, h, 1), () => j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 1, depositTxHash: HASH_A }))
  assert.equal(tiny.status, 400)
  assert.match(tiny.body.error, /at least 50/)
})

test('real money: a matching on-chain deposit makes it official, confirmed at once; the hash cannot be reused', async () => {
  const addr = 'NQ12 1212 1212 1212 1212 1212 1212 1212 1212'
  const id = (await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr })).body.id
  const chain = async (_t: string, cid: string, h: string) => (cid === id && h === HASH_A ? depositOf(cid, h, 100) : null)
  const ok = await realMoney(chain, () => j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 100, depositTxHash: HASH_A.toUpperCase() }))
  assert.equal(ok.status, 200)
  assert.equal(ok.body.status, 'official')
  const p = db.getChallenge(id)!.participants[0]
  assert.equal(p.depositConfirmed, 1, 'confirmed right away — settlement can pay without a second lookup')
  assert.equal(p.depositTxHash, HASH_A, 'canonical lower-case hash stored')
  // retry after a lost response: idempotent, still 200
  const retry = await realMoney(chain, () => j('POST', `/challenges/${id}/official`, { address: addr, durationDays: 7, stake: 100, depositTxHash: HASH_A }))
  assert.equal(retry.status, 200)
  // the same deposit cannot back a second run (consume-once)
  const addr2 = 'NQ13 1313 1313 1313 1313 1313 1313 1313 1313'
  const id2 = (await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: addr2 })).body.id
  const reuse = await realMoney(async (_t, cid, h) => depositOf(cid, h, 100), () => j('POST', `/challenges/${id2}/official`, { address: addr2, durationDays: 7, stake: 100, depositTxHash: HASH_A }))
  assert.equal(reuse.status, 409)
  const fresh = await realMoney(async (_t, cid, h) => (cid === id2 && h === HASH_B ? depositOf(cid, h, 100) : null), () => j('POST', `/challenges/${id2}/official`, { address: addr2, durationDays: 7, stake: 100, depositTxHash: HASH_B }))
  assert.equal(fresh.status, 200)
})
