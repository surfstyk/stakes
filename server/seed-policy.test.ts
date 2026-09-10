// The seed budget decision (server/seed-policy.ts) — pure, so every lane is a one-liner.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedCapsFromEnv, seedVerdict, type SeedCaps } from './seed-policy.ts'

const caps: SeedCaps = { daily: 2000, hourly: 200, perIp: 20, repeatPool: 1000 }
const ok = (r: ReturnType<typeof seedVerdict>) => (r.ok ? r.lane : `deny:${r.reason}`)

test('defaults from env: 2000/day, 200/hour, 20/IP, repeat pool 1000; garbage falls back', () => {
  assert.deepEqual(seedCapsFromEnv({}), caps)
  assert.deepEqual(seedCapsFromEnv({ STAKES_SEED_HOURLY_CAP: '50', STAKES_SEED_REPEAT_POOL: 'nope', STAKES_SEED_PER_IP_DAILY: '-1' }), { ...caps, hourly: 50 })
})

test('a network\'s first seed of the day is a newcomer and is served while the day has budget', () => {
  assert.equal(ok(seedVerdict({ total24h: 1999, total1h: 0, byIp24h: 0 }, caps)), 'newcomer')
  assert.equal(ok(seedVerdict({ total24h: 1500, total1h: 199, byIp24h: 0 }, caps)), 'newcomer')
})

test('the daily cap is the hard bound for everyone', () => {
  assert.equal(ok(seedVerdict({ total24h: 2000, total1h: 0, byIp24h: 0 }, caps)), 'deny:day')
})

test('the hourly ceiling bounds the burn rate for everyone, newcomers included', () => {
  assert.equal(ok(seedVerdict({ total24h: 300, total1h: 200, byIp24h: 0 }, caps)), 'deny:hour')
})

test('repeats are served under the per-IP cap while the day is under the repeat pool', () => {
  assert.equal(ok(seedVerdict({ total24h: 999, total1h: 10, byIp24h: 19 }, caps)), 'repeat')
  assert.equal(ok(seedVerdict({ total24h: 999, total1h: 10, byIp24h: 20 }, caps)), 'deny:ip')
  assert.equal(ok(seedVerdict({ total24h: 1000, total1h: 10, byIp24h: 1 }, caps)), 'deny:repeat')
})

test('replay of the 2026-09-09 farm: a rotating IP gets its per-IP take only for the first half of the day', () => {
  // 15 IPs × 20 seeds, hour by hour under the ceiling
  let total = 0
  let hour = 0
  let served = 0
  for (let ip = 0; ip < 15; ip++) {
    for (let k = 0; k < 20; k++) {
      const v = seedVerdict({ total24h: total, total1h: hour, byIp24h: k }, caps)
      if (v.ok) {
        total++
        hour++
        served++
      }
    }
  }
  assert.equal(served, 200, 'under the hourly ceiling the first hour serves exactly 200')
  // A brand-new network still gets its seed once the hour rolls
  assert.equal(ok(seedVerdict({ total24h: total, total1h: 0, byIp24h: 0 }, caps)), 'newcomer')
})

test('error strings the client may show are the original ones', () => {
  const r = seedVerdict({ total24h: 5, total1h: 5, byIp24h: 20 }, caps)
  assert.ok(!r.ok && r.error === 'too many seeds from this network today')
})
