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
const { server } = await import('./api.ts')

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

test('POST /challenges starts a taste; the ≤1-active invariant blocks a second live start', async () => {
  const a = await j('POST', '/challenges', { templateId: 'sugar', goal: 'going sugar-free', emoji: '🍩', creatorAddress: NQ })
  assert.equal(a.status, 201)
  assert.equal(a.body.status, 'window')
  assert.equal(a.body.templateId, 'sugar')
  assert.equal(a.body.durationDays, 0)

  const dup = await j('POST', '/challenges', { templateId: 'run', goal: 'running', emoji: '🏃', creatorAddress: NQ })
  assert.equal(dup.status, 409, 'a live taste blocks a second start')
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
