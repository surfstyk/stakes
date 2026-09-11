// The burst alarm — runs inside the settle tick (server/settle-due.ts), which is a fresh process every
// minute, so the once-per-hour cooldown lives in the DB (`alerts`). Reads game state, writes only that
// table, never blocks settlement (the caller wraps it). Learned from the 2026-09-09 seed farm, which
// nobody saw for hours (AUDIT-CYCLE-II.md §9): 200 seeds in 10 minutes, and we had no log and no alarm.
//
// What it watches (all env dials):
//   seed-burst     seeds requested in 10 min ≥ STAKES_ALERT_SEED_10M (30) or in 1 h ≥ …_1H (100)
//   seed-budget    the rolling-24h seed count ≥ STAKES_ALERT_BUDGET_PCT (50) % of the daily cap
//   foreign-writes taste replace/delete calls from a different network than the creator, ≥ …_FOREIGN_10M
//                  (3) in 10 min — the identity-griefing tripwire (§9 C2 → ship the run token)
//   create-flood   challenges created in 10 min ≥ STAKES_ALERT_CREATE_10M (60)
// Delivery: always the journal (`[alert] …`); plus STAKES_ALERT_WEBHOOK if set. Format auto-detected
// from the host, or forced with STAKES_ALERT_FORMAT:
//   telegram  api.telegram.org/bot<TOKEN>/sendMessage — POST {chat_id, text}; needs STAKES_ALERT_CHAT_ID.
//             The bot token lives in the URL, both it and the chat id are box secrets (never the repo).
//   json      anything else — POST {text, content}: Slack reads `text`, Discord reads `content`.
// One message per kind per STAKES_ALERT_COOLDOWN_MS (1 h).
//
//   STAKES_ALERT_WEBHOOK=https://api.telegram.org/bot<TOKEN>/sendMessage STAKES_ALERT_CHAT_ID=<id> \
//     STAKES_DB=/tmp/alert-test.db node --import tsx server/alert-due.ts --test   # one synthetic alert, no game state

import { countChallengesSince, countSecurityEventsSince, countSeedsSince, getAlertState, setAlertState } from './db.ts'
import { seedCapsFromEnv } from './seed-policy.ts'

export interface AlertOpts {
  now?: number
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  log?: (msg: string) => void
}

export interface AlertResult {
  fired: string[]
  suppressed: string[]
  checked: Record<string, number>
}

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

export async function alertDue(opts: AlertOpts = {}): Promise<AlertResult> {
  const now = opts.now ?? Date.now()
  const env = opts.env ?? process.env
  const log = opts.log ?? (() => {})
  const n = (k: string, d: number) => {
    const v = Number(env[k])
    return Number.isFinite(v) && v >= 0 ? v : d
  }
  const caps = seedCapsFromEnv(env)
  const checked = {
    seeds10m: countSeedsSince(now - 10 * MIN),
    seeds1h: countSeedsSince(now - HOUR),
    seeds24h: countSeedsSince(now - DAY),
    foreign10m: countSecurityEventsSince(now - 10 * MIN, ['taste-replaced-foreign', 'taste-deleted-foreign']),
    created10m: countChallengesSince(now - 10 * MIN),
  }

  const triggers: { kind: string; msg: string }[] = []
  const seedLine = `${checked.seeds10m} in 10 min · ${checked.seeds1h} in 1 h · ${checked.seeds24h}/${caps.daily} in 24 h`
  if (checked.seeds10m >= n('STAKES_ALERT_SEED_10M', 30) || checked.seeds1h >= n('STAKES_ALERT_SEED_1H', 100)) {
    triggers.push({ kind: 'seed-burst', msg: `seed requests ${seedLine}. Kill switch: STAKES_SEED_OFF=1 on stakes-api.` })
  }
  if (caps.daily > 0 && checked.seeds24h >= Math.ceil((caps.daily * n('STAKES_ALERT_BUDGET_PCT', 50)) / 100)) {
    triggers.push({ kind: 'seed-budget', msg: `daily seed budget ${checked.seeds24h}/${caps.daily} used (${seedLine}).` })
  }
  if (checked.foreign10m >= n('STAKES_ALERT_FOREIGN_10M', 3)) {
    triggers.push({ kind: 'foreign-writes', msg: `${checked.foreign10m} taste replace/delete calls in 10 min from a network other than the creator's — identity griefing? (AUDIT §9 C2: ship the run token.)` })
  }
  if (checked.created10m >= n('STAKES_ALERT_CREATE_10M', 60)) {
    triggers.push({ kind: 'create-flood', msg: `${checked.created10m} challenges created in 10 min.` })
  }

  const cooldown = n('STAKES_ALERT_COOLDOWN_MS', HOUR)
  const fired: string[] = []
  const suppressed: string[] = []
  for (const t of triggers) {
    const last = getAlertState(t.kind)
    if (last && now - last.lastAt < cooldown) {
      suppressed.push(t.kind)
      continue
    }
    const text = `Stakes alert [${t.kind}] ${t.msg}`
    log(`[alert] ${text}`)
    await sendWebhook(env, text, opts.fetchImpl ?? fetch, log)
    setAlertState(t.kind, now, text)
    fired.push(t.kind)
  }
  return { fired, suppressed, checked }
}

export async function sendWebhook(env: NodeJS.ProcessEnv, text: string, f: typeof fetch, log: (m: string) => void): Promise<boolean> {
  const url = (env.STAKES_ALERT_WEBHOOK ?? '').trim()
  if (!url) return false
  let host: string
  try {
    host = new URL(url).host
  } catch {
    log('[alert] STAKES_ALERT_WEBHOOK is not a valid URL')
    return false
  }
  const fmt = env.STAKES_ALERT_FORMAT
  const telegram = fmt === 'telegram' || (!fmt && /(^|\.)api\.telegram\.org$/.test(host))
  try {
    let res: Response
    if (telegram) {
      // Telegram Bot API sendMessage: token is in the URL, chat id is the one extra piece. Plain text —
      // no MarkdownV2 escaping to trip over on messages full of IPs and slashes.
      const chatId = (env.STAKES_ALERT_CHAT_ID ?? '').trim()
      if (!chatId) {
        log('[alert] telegram delivery needs STAKES_ALERT_CHAT_ID')
        return false
      }
      res = await f(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      })
    } else {
      res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) })
    }
    if (!res.ok) log(`[alert] webhook answered ${res.status}`)
    return res.ok
  } catch (e) {
    log(`[alert] webhook failed — ${(e as Error).message}`)
    return false
  }
}

// `--test`: one synthetic message through the configured webhook, nothing else.
if (process.argv[1]?.endsWith('alert-due.ts') && process.argv.includes('--test')) {
  const ok = await sendWebhook(process.env, `Stakes alert [test] the burst alarm is wired (${new Date().toISOString()}).`, fetch, (m) => console.log(m))
  console.log(ok ? '[alert] test message sent' : '[alert] no message sent (STAKES_ALERT_WEBHOOK unset or refused)')
  process.exit(ok ? 0 : 1)
}
