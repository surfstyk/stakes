// The seed budget — pure decision, no I/O (server/api.ts feeds it the counts).
//
// Learned from the 2026-09-09 farm (AUDIT-CYCLE-II.md §9): a rotating-IP script took 20 seeds per
// IP and moved on, so any per-IP cap alone is a speed bump, and a shared 24h pool can be emptied in
// ~100 minutes — after which every REAL newcomer is refused for up to a day. Four rules, in order:
//   1. daily      — the treasury bound (unchanged, Hendrik's number);
//   2. hourly     — the burn-rate bound: emptying the day now takes ≥ 10 hours, and the settle tick's
//                   alarm (server/alert-due.ts) fires within minutes of a burst;
//   3. newcomer   — a network's FIRST seed of the day is served while any budget remains;
//   4. repeat     — a network's 2nd…Nth seed is served only under its per-IP cap AND while the day is
//                   under the repeat pool (half the budget). A farm gets its full per-IP take only for
//                   the first half of the day; starving newcomers then needs thousands of distinct IPs.
// A free faucet to fresh wallets cannot be made un-farmable without a cost at the client, and the
// zero-dialog onboarding forbids every visible cost — so the goal is not "stop farming" but "farming
// never takes the seed from a real newcomer, and we see it". All numbers are env dials.

export interface SeedCaps {
  daily: number
  hourly: number
  perIp: number
  repeatPool: number
}

export function seedCapsFromEnv(env: NodeJS.ProcessEnv = process.env): SeedCaps {
  const n = (k: string, d: number) => {
    const v = Number(env[k])
    return Number.isFinite(v) && v >= 0 ? v : d
  }
  return {
    daily: n('STAKES_SEED_DAILY_CAP', 2_000),
    hourly: n('STAKES_SEED_HOURLY_CAP', 200),
    perIp: n('STAKES_SEED_PER_IP_DAILY', 20),
    repeatPool: n('STAKES_SEED_REPEAT_POOL', 1_000),
  }
}

export interface SeedLoad {
  total24h: number
  total1h: number
  byIp24h: number
}

export type SeedVerdict =
  | { ok: true; lane: 'newcomer' | 'repeat' }
  | { ok: false; reason: 'day' | 'hour' | 'ip' | 'repeat'; error: string }

const deny = (reason: 'day' | 'hour' | 'ip' | 'repeat', error: string): SeedVerdict => ({ ok: false, reason, error })

export function seedVerdict(load: SeedLoad, caps: SeedCaps): SeedVerdict {
  if (load.total24h >= caps.daily) return deny('day', 'seed cap reached for today')
  if (load.total1h >= caps.hourly) return deny('hour', 'seed cap reached for this hour')
  if (load.byIp24h === 0) return { ok: true, lane: 'newcomer' }
  if (load.byIp24h >= caps.perIp) return deny('ip', 'too many seeds from this network today')
  if (load.total24h >= caps.repeatPool) return deny('repeat', 'seed cap reached for repeat requests today')
  return { ok: true, lane: 'repeat' }
}
