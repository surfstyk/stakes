// The burst alarm (server/alert-due.ts) — thresholds, cooldown, and the telegram + JSON webhook formats.
// All offline: a temp DB, an injected fetch that records calls.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'stakes-alert-'))
process.env.STAKES_DB = join(dir, 'test.db')

const db = await import('./db.ts')
const { alertDue, sendWebhook } = await import('./alert-due.ts')
const { KeyPair } = await import('@nimiq/core')

after(() => rmSync(dir, { recursive: true, force: true }))

const nqAddr = () => KeyPair.generate().toAddress().toUserFriendlyAddress()
const challenge = () =>
  db.createChallenge({
    goal: 'run', emoji: '🏃', durationDays: 0, stake: 0, asset: 'NIM',
    creatorAddress: nqAddr(), creatorName: 'x', lockAt: Date.now(), dayLengthMs: 86400_000, creatorFp: 'fp-test',
  })
const quiet = { STAKES_ALERT_SEED_10M: '1000', STAKES_ALERT_SEED_1H: '1000', STAKES_SEED_DAILY_CAP: '100000', STAKES_ALERT_FOREIGN_10M: '1000', STAKES_ALERT_CREATE_10M: '1000' }

function recorder() {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response('ok', { status: 200 })
  }) as unknown as typeof fetch
  return { calls, f }
}

test('quiet state fires nothing and calls no webhook', async () => {
  const { calls, f } = recorder()
  const r = await alertDue({ env: { ...quiet, STAKES_ALERT_WEBHOOK: 'https://api.telegram.org/bot1:ABC/sendMessage', STAKES_ALERT_CHAT_ID: '42' }, fetchImpl: f })
  assert.deepEqual(r.fired, [])
  assert.equal(calls.length, 0)
})

test('a seed burst fires once, posts to telegram, then is suppressed by the cooldown', async () => {
  const id = challenge()
  for (let i = 0; i < 3; i++) db.requestSeed({ address: nqAddr(), challengeId: id, ipHash: 'burst', luna: 1 })
  const { calls, f } = recorder()
  const env = { ...quiet, STAKES_ALERT_SEED_10M: '3', STAKES_ALERT_WEBHOOK: 'https://api.telegram.org/bot1:ABC/sendMessage', STAKES_ALERT_CHAT_ID: '42' }
  const logs: string[] = []
  const r1 = await alertDue({ env, fetchImpl: f, log: (m) => logs.push(m) })
  assert.deepEqual(r1.fired, ['seed-burst'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.telegram.org/bot1:ABC/sendMessage')
  const body = JSON.parse(String(calls[0].init.body))
  assert.equal(body.chat_id, '42')
  assert.match(body.text, /^Stakes alert \[seed-burst\]/)
  assert.ok(logs.some((l) => l.startsWith('[alert] Stakes alert [seed-burst]')), 'journal line')
  // same minute again → suppressed, no second post
  const r2 = await alertDue({ env, fetchImpl: f })
  assert.deepEqual(r2.fired, [])
  assert.deepEqual(r2.suppressed, ['seed-burst'])
  assert.equal(calls.length, 1)
  // once the cooldown has passed → fires again (a zero cooldown here; the counting windows must not move)
  const r3 = await alertDue({ env: { ...env, STAKES_ALERT_COOLDOWN_MS: '0' }, fetchImpl: f })
  assert.deepEqual(r3.fired, ['seed-burst'])
  assert.equal(calls.length, 2)
})

test('a telegram webhook posts {chat_id, text}; auto-detected from the host', async () => {
  const { calls, f } = recorder()
  const env = { STAKES_ALERT_WEBHOOK: 'https://api.telegram.org/bot123:ABC/sendMessage', STAKES_ALERT_CHAT_ID: '42' }
  const ok = await sendWebhook(env, 'hello', f, () => {})
  assert.equal(ok, true)
  assert.equal((calls[0].init.headers as Record<string, string>)['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { chat_id: '42', text: 'hello', disable_web_page_preview: true })
})

test('telegram without a chat id sends nothing and says why', async () => {
  const { calls, f } = recorder()
  const logs: string[] = []
  const ok = await sendWebhook({ STAKES_ALERT_WEBHOOK: 'https://api.telegram.org/bot123:ABC/sendMessage' }, 'x', f, (m) => logs.push(m))
  assert.equal(ok, false)
  assert.equal(calls.length, 0)
  assert.ok(logs.some((l) => l.includes('STAKES_ALERT_CHAT_ID')))
})

test('a generic webhook gets JSON with both `text` (Slack) and `content` (Discord)', async () => {
  const { calls, f } = recorder()
  const ok = await sendWebhook({ STAKES_ALERT_WEBHOOK: 'https://hooks.example.com/abc' }, 'hello', f, () => {})
  assert.equal(ok, true)
  assert.equal((calls[0].init.headers as Record<string, string>)['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { text: 'hello', content: 'hello' })
})

test('no webhook configured → the alarm still fires to the journal; a bad URL never throws', async () => {
  const { calls, f } = recorder()
  assert.equal(await sendWebhook({}, 'x', f, () => {}), false)
  const logs: string[] = []
  assert.equal(await sendWebhook({ STAKES_ALERT_WEBHOOK: 'not a url' }, 'x', f, (m) => logs.push(m)), false)
  assert.ok(logs.some((l) => l.includes('not a valid URL')))
  assert.equal(calls.length, 0)
})

test('the identity-griefing tripwire needs a cluster (3 foreign writes in 10 min)', async () => {
  const { calls, f } = recorder()
  const env = { ...quiet, STAKES_ALERT_FOREIGN_10M: '3', STAKES_ALERT_COOLDOWN_MS: '0', STAKES_ALERT_WEBHOOK: 'https://hooks.example.com/t' }
  db.recordSecurityEvent({ kind: 'taste-replaced-foreign', fp: 'a', address: 'NQ..', challengeId: 'c1' })
  db.recordSecurityEvent({ kind: 'taste-deleted-foreign', fp: 'b', address: 'NQ..', challengeId: 'c2' })
  let r = await alertDue({ env, fetchImpl: f })
  assert.ok(!r.fired.includes('foreign-writes'), 'two events are one honest user switching networks')
  db.recordSecurityEvent({ kind: 'taste-replaced-foreign', fp: 'c', address: 'NQ..', challengeId: 'c3' })
  r = await alertDue({ env, fetchImpl: f })
  assert.ok(r.fired.includes('foreign-writes'))
  assert.match(String(calls.at(-1)!.init.body), /identity griefing/)
})

test('the daily budget alarm reads the live seed caps', async () => {
  const { f } = recorder()
  const total = db.countSeedsSince(Date.now() - 86_400_000)
  const env = { ...quiet, STAKES_SEED_DAILY_CAP: String(total * 2), STAKES_ALERT_BUDGET_PCT: '50', STAKES_ALERT_COOLDOWN_MS: '0' }
  const r = await alertDue({ env, fetchImpl: f })
  assert.ok(r.fired.includes('seed-budget'))
  assert.equal(r.checked.seeds24h, total)
})
