// The reshape data layer — one surface the screens call, two adapters behind it.
//
//   MOCK  (no treasury configured → `vite --mode mock`): the whole funnel runs in a plain
//         browser off localStorage + the mock vault/stamp, so the look is reviewable with no
//         server. This is what the design run uses.
//   API   (treasury configured): the same calls hit the same-origin /api the server rebuild
//         implements. Wired here so the swap is a one-line gate, never
//         a UI change — same discipline as the StakeVault.
//
// Money + on-chain: deposits go through getVault() (tagged `official:<id>`); seals stamp the
// chain via sendStamp (tagged `day:<id>:<n>`). Both are mock in a mock build (the invariant).

import type { Challenge, HistoryItem, Me, Social } from './model.ts'
import { currentDay, isTerminal, keptDays, outcomeOf } from './model.ts'
import { DAY_MS } from '../vault/schedule.ts'
import { getVault } from '../vault/index.ts'
import { sendStamp } from '../vault/stamp.ts'
import { TREASURY_NIM_ADDRESS } from '../vault/custodialNim.ts'
import { getNimiq } from '../lib/nimiq.ts'
import { safeRandomId } from '../lib/id.ts'
import { DEV_TOOLS } from '../lib/flags.ts'
import { templateById } from './templates.ts'

const IS_MOCK = !TREASURY_NIM_ADDRESS

// ---- identity (Nimiq wallet address, dev fallback) — standalone so reshape stays decoupled ----
//
// The identity is `listAccounts()[0]`, the STABLE wallet address (the *sending* sub-address
// rotates per tx; this one does not — audit ARCH-02 / BACKLOG). We PERSIST it after the first
// resolve, because `listAccounts()` opens the native Connect sheet on every fresh page load: the
// SDK provider's grant cache is in-memory, so a reload / reopen resets it to empty and calling
// it again re-prompts ("connect again every time you come back"). Reading our own cache instead
// keeps every return, and every reload, dialog-free — the wallet is only ever asked once.
const NIM_ADDR_KEY = 'stakes.nim.address'
const CONNECT_TIMEOUT_MS = 60_000
let cachedAddress: string | null = null
let addressInFlight: Promise<string> | null = null

function readPersistedAddress(): string | null {
  try {
    return localStorage.getItem(NIM_ADDR_KEY)
  } catch {
    return null
  }
}

/** Reject `p` if it hasn't settled within `ms` — bounds a native sheet that is never answered
 *  (declined and swallowed by the host, or lost to a backgrounding) so a caller can't hang forever. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Wallet did not respond in time.')), ms)),
  ])
}

/**
 * True when we can load state WITHOUT triggering the native Connect sheet — a mock build always,
 * or a real wallet address we already resolved on a prior run. Drives the instant-paint mount
 * (App.tsx): an unknown identity lands on the cold-open and only connects on the first real action.
 */
export function hasKnownIdentity(): boolean {
  return IS_MOCK || Boolean(cachedAddress) || Boolean(readPersistedAddress())
}

/**
 * Resolve this device's identity address. Cache-first (memory → localStorage) so it is silent and
 * synchronous for a returning wallet; only a first-ever resolve calls `listAccounts()` and opens
 * the Connect sheet. Concurrent callers share the one in-flight prompt.
 */
export function getMyAddress(): Promise<string> {
  if (cachedAddress) return Promise.resolve(cachedAddress)
  const persisted = readPersistedAddress()
  if (persisted) return Promise.resolve((cachedAddress = persisted))
  return (addressInFlight ??= resolveAddress().finally(() => (addressInFlight = null)))
}

async function resolveAddress(): Promise<string> {
  if (typeof window !== 'undefined' && window.nimiqPay) {
    try {
      const nim = await getNimiq(4000)
      const accounts = await withTimeout(nim.listAccounts(), CONNECT_TIMEOUT_MS)
      if (Array.isArray(accounts) && accounts[0]) {
        cachedAddress = accounts[0]
        try {
          localStorage.setItem(NIM_ADDR_KEY, accounts[0])
        } catch {
          /* private mode / quota — we still hold it in memory for this session */
        }
        return cachedAddress
      }
      throw new Error('The wallet returned no account.')
    } catch (e) {
      // A real-money build must NOT fabricate a throwaway identity: tagging a run (and a real
      // deposit) to an address the wallet never controls is worse than a clean failure. Surface it
      // so the caller's guard() shows a calm, retryable state.
      if (!IS_MOCK) throw e instanceof Error ? e : new Error('Could not reach your wallet.')
    }
  }
  // Mock / outside Nimiq Pay: a stable per-device dev identity keeps the design run clickable.
  try {
    const k = 'stakes.devAddress'
    const existing = localStorage.getItem(k)
    if (existing) return (cachedAddress = existing)
    const a = 'DEV-' + safeRandomId().replace(/-/g, '').slice(0, 12).toUpperCase()
    localStorage.setItem(k, a)
    return (cachedAddress = a)
  } catch {
    return (cachedAddress = 'DEV-ANON')
  }
}

// ---- fast clock (dev only) — a compressed "day" so the whole arc is walkable in minutes ----
const TEST_KEY = 'stakes.testmode'
const TEST_DAY_MS = 3 * 60_000
export function isTestMode(): boolean {
  if (!DEV_TOOLS) return false
  try {
    return localStorage.getItem(TEST_KEY) === '1'
  } catch {
    return false
  }
}
/** Persist the fast-clock flag (set from ?test) so it survives the router rewriting the query. */
export function setTestMode(on: boolean) {
  try {
    localStorage.setItem(TEST_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
function dayLen(): number {
  return isTestMode() ? TEST_DAY_MS : DAY_MS
}

export interface DeckStake {
  perDay: number
  days: number
}

export interface DataApi {
  getMe(): Promise<Me>
  getSocial(): Promise<Social>
  startChallenge(templateId: string): Promise<Challenge>
  makeOfficial(id: string, stake: DeckStake): Promise<Challenge>
  sealDay(id: string): Promise<Challenge>
  deleteAttempt(id: string): Promise<void>
  /** Retire a finished/lapsed run into history and start a fresh one on `templateId`
   *  (re-runs skip the taste — the caller routes straight to Make-official, JOURNEY §12.5). */
  reRun(templateId: string): Promise<Challenge>
  /** Retire a finished/lapsed run into history and leave no active run (→ Archive/Main). */
  discardActive(): Promise<void>
}

// ============================================================================
// MOCK adapter — localStorage-backed, the design run
// ============================================================================

interface MockState {
  seq: number
  active: Challenge | null
  history: HistoryItem[]
}
const MOCK_KEY = 'stakes.rs.v1'

function loadMock(): MockState {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (raw) return JSON.parse(raw) as MockState
  } catch {
    /* ignore */
  }
  return { seq: 47, active: null, history: [] }
}
function saveMock(s: MockState) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(s))
  } catch {
    /* quota / private mode */
  }
}

/** Retire the active run into history IF it has come to rest (ended / lapsed). Non-terminal
 *  runs are left in place so the Taste / Day / Banked / Lapsed screens can show them. */
function archive(s: MockState, now: number): MockState {
  if (!s.active) return s
  if (!isTerminal(s.active, now)) return s
  const a = s.active
  const staked = Boolean(a.stakedAt)
  s.history = [historyOf(a, keptDays(a).size, staked), ...s.history]
  s.active = null
  return s
}

function historyOf(ch: Challenge, kept: number, staked: boolean): HistoryItem {
  return {
    id: ch.id,
    templateId: ch.templateId,
    goal: ch.goal,
    emoji: ch.emoji,
    outcome: outcomeOf(kept, ch.durationDays, staked),
    kept,
    total: ch.durationDays,
    stake: ch.stake,
    endedAt: Date.now(),
  }
}

/** Create the taste (window) challenge on an already-clear state, fire the silent seed, save. */
async function createWindowMock(s: MockState, templateId: string): Promise<Challenge> {
  const now = Date.now()
  const t = templateById(templateId)
  const address = await getMyAddress()
  const ch: Challenge = {
    id: safeRandomId().replace(/-/g, '').slice(0, 8),
    templateId,
    goal: t?.goal ?? templateId,
    emoji: t?.emoji ?? '🔥',
    status: 'window',
    creatorAddress: address,
    createdAt: now,
    lockAt: now,
    dayLengthMs: dayLen(),
    durationDays: 0,
    stake: 0,
    asset: 'NIM',
    stakedAt: null,
    checkins: [],
    seq: ++s.seq,
  }
  s.active = ch
  saveMock(s)
  // fire the silent seed (on-chain noise, minute one) — no-op in mock, real POST otherwise.
  void seedSilently(ch.id, address)
  return ch
}

const mockApi: DataApi = {
  async getMe() {
    // No archiving here — a terminal run (ended / lapsed) stays "active" so its payoff / lapse
    // screen can show; the next user action (reRun / discard / start) retires it.
    const s = loadMock()
    return { active: s.active, history: s.history }
  },
  async getSocial() {
    // Honest counters: in mock there are no real wallets, so nothing is invented.
    const s = loadMock()
    const startedThisWeek: Record<string, number> = {}
    if (s.active) startedThisWeek[s.active.templateId] = 1
    return { startedThisWeek }
  },
  async startChallenge(templateId) {
    const now = Date.now()
    const s = loadMock()
    if (s.active && !isTerminal(s.active, now)) {
      throw new Error('You already have a challenge running. Finish it first.')
    }
    return createWindowMock(archive(s, now), templateId)
  },
  async reRun(templateId) {
    return createWindowMock(archive(loadMock(), Date.now()), templateId)
  },
  async discardActive() {
    saveMock(archive(loadMock(), Date.now()))
  },
  async makeOfficial(id, stake) {
    const s = loadMock()
    if (!s.active || s.active.id !== id) throw new Error('Challenge not found')
    const total = stake.perDay * stake.days
    const receipt = await getVault().deposit({ challengeId: id, amount: total, asset: 'NIM' })
    s.active = {
      ...s.active,
      status: 'official',
      durationDays: stake.days,
      stake: total,
      stakedAt: Date.now(),
      // lockAt STAYS = the taste start (the backdate).
    }
    void receipt // the mock vault confirms synchronously; the API path verifies on-chain
    saveMock(s)
    return s.active
  },
  async sealDay(id) {
    const s = loadMock()
    if (!s.active || s.active.id !== id) throw new Error('Challenge not found')
    const now = Date.now()
    const day = currentDay(s.active, now)
    if (day < 0 || day >= s.active.durationDays) throw new Error('No day is open to seal right now.')
    if (keptDays(s.active).has(day)) return s.active // already sealed today
    // the stamp is offered, never a wall: a decline still keeps the seal in-app.
    let stampTxHash: string | null = null
    let stampStatus: 'landed' | 'declined' = 'landed'
    try {
      const r = await sendStamp({ challengeId: id, dayIndex: day })
      stampTxHash = r.hash
    } catch {
      stampStatus = 'declined'
    }
    s.active = {
      ...s.active,
      checkins: [...s.active.checkins, { day, at: now, stampTxHash, stampStatus }],
    }
    saveMock(s)
    return s.active
  },
  async deleteAttempt(id) {
    const s = loadMock()
    if (s.active && s.active.id === id && s.active.status === 'window' && !s.active.stakedAt) {
      s.active = null
      saveMock(s)
    }
  },
}

// ============================================================================
// API adapter — the same-origin server; wired for the swap
// ============================================================================

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('/api' + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const b = (await res.json()) as { error?: string }
      if (b?.error) msg = b.error
    } catch {
      /* non-JSON */
    }
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ---- the deposit receipt (audit M1): survives a failed register call and an app restart ----
const RECEIPT_KEY = (id: string) => `stakes.receipt.${id}`
interface Receipt {
  ref: string
  total: number
  days: number
  at: number
}
function loadReceipt(id: string, total: number): string | null {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY(id))
    if (!raw) return null
    const r = JSON.parse(raw) as Receipt
    // only reuse a receipt for the SAME amount — a different stake choice is a different deposit
    return r.total === total && r.ref ? r.ref : null
  } catch {
    return null
  }
}
function saveReceipt(id: string, total: number, days: number, ref: string) {
  try {
    localStorage.setItem(RECEIPT_KEY(id), JSON.stringify({ ref, total, days, at: Date.now() } satisfies Receipt))
  } catch {
    /* private mode / quota: the server-side idempotency still covers the lost-response case */
  }
}
function clearReceipt(id: string) {
  try {
    localStorage.removeItem(RECEIPT_KEY(id))
  } catch {
    /* ignore */
  }
}

async function seedSilently(challengeId: string, address: string): Promise<void> {
  if (IS_MOCK) return
  try {
    await api('/seed', { method: 'POST', body: JSON.stringify({ address, challengeId }) })
  } catch {
    /* the seed is best-effort noise; never block the flow */
  }
}

const serverApi: DataApi = {
  async getMe() {
    const address = await getMyAddress()
    return api<Me>(`/me?address=${encodeURIComponent(address)}`)
  },
  async getSocial() {
    return api<Social>('/stats/social')
  },
  async startChallenge(templateId) {
    const address = await getMyAddress()
    const t = templateById(templateId)
    const ch = await api<Challenge>('/challenges', {
      method: 'POST',
      body: JSON.stringify({ templateId, goal: t?.goal ?? templateId, emoji: t?.emoji ?? '🔥', creatorAddress: address }),
    })
    void seedSilently(ch.id, address)
    return ch
  },
  async makeOfficial(id, stake) {
    const address = await getMyAddress()
    const total = stake.perDay * stake.days
    // The deposit is real money and happens BEFORE the register call. If that call fails (network
    // blip, app killed in between), a retry must never deposit twice: the receipt is persisted the
    // moment the wallet returns it and reused until the server has acknowledged the run (audit M1).
    // The server's /official is idempotent for the creator, so re-posting a stored receipt is safe.
    let ref = loadReceipt(id, total)
    if (!ref) {
      const receipt = await getVault().deposit({ challengeId: id, amount: total, asset: 'NIM' })
      ref = receipt.ref ?? ''
      saveReceipt(id, total, stake.days, ref)
    }
    // The server registers the run only once the deposit is visible on-chain (402 until then —
    // inclusion takes a moment after the wallet returns). Retry quietly; the receipt is kept, so a
    // retry re-posts the same hash and never deposits again.
    let ch: Challenge | undefined
    for (let attempt = 0; ; attempt++) {
      try {
        ch = await api<Challenge>(`/challenges/${id}/official`, {
          method: 'POST',
          body: JSON.stringify({ address, durationDays: stake.days, stake: total, depositTxHash: ref }),
        })
        break
      } catch (e) {
        if ((e as { status?: number }).status === 402 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 3000))
          continue
        }
        throw e
      }
    }
    clearReceipt(id)
    return ch
  },
  async sealDay(id) {
    const address = await getMyAddress()
    const me = await api<Me>(`/me?address=${encodeURIComponent(address)}`)
    const ch = me.active
    if (!ch || ch.id !== id) throw new Error('Challenge not found')
    const day = currentDay(ch)
    let stampTxHash: string | undefined
    try {
      const r = await sendStamp({ challengeId: id, dayIndex: day })
      stampTxHash = r.hash
    } catch {
      /* declined — the check-in still lands */
    }
    return api<Challenge>(`/challenges/${id}/checkins`, {
      method: 'POST',
      body: JSON.stringify({ address, day, stampTxHash }),
    })
  },
  async deleteAttempt(id) {
    await api(`/challenges/${id}`, { method: 'DELETE' })
  },
  async reRun(templateId) {
    // The server retires the finished run and opens a fresh one (skips the taste, §12.5).
    return serverApi.startChallenge(templateId)
  },
  async discardActive() {
    const address = await getMyAddress()
    await api('/me/archive', { method: 'POST', body: JSON.stringify({ address }) })
  },
}

export const data: DataApi = IS_MOCK ? mockApi : serverApi
export const IS_MOCK_DATA = IS_MOCK

// ---- dev seeding — plant any arc state so the design run shows real dots + payoffs ----
export type SeedKind =
  | 'taste'
  | 'day'
  | 'day2of3'
  | 'long'
  | 'sealed'
  | 'sealone'
  | 'missed'
  | 'banked-win'
  | 'banked-partial'
  | 'banked-wipeout'
  | 'reup'
  | 'lapsed'
  | 'archive'
  | 'clear'

export function devSeed(kind: SeedKind): void {
  const now = Date.now()
  const len = dayLen()
  const DAY = 86_400_000
  // dev-only: ?tpl=<id> seeds a specific template (e.g. run = "Move every day") for asset/trailer
  // captures; defaults to sugar. Only ever reached under DEV_TOOLS (App.tsx), stripped from public.
  const tplId = new URLSearchParams(location.search).get('tpl') || 'sugar'
  const t = templateById(tplId) ?? templateById('sugar')!
  const base = (o: Partial<Challenge>): Challenge => ({
    id: safeRandomId().replace(/-/g, '').slice(0, 8),
    templateId: t.id,
    goal: t.goal,
    emoji: t.emoji,
    status: 'window',
    creatorAddress: 'DEV-SEED',
    createdAt: now,
    lockAt: now,
    dayLengthMs: len,
    durationDays: 0,
    stake: 0,
    asset: 'NIM',
    stakedAt: null,
    checkins: [],
    seq: 48,
    ...o,
  })
  const kept = (n: number): Challenge['checkins'] =>
    Array.from({ length: n }, (_, i) => ({ day: i, at: now - (n - i) * len, stampTxHash: 'mock', stampStatus: 'landed' as const }))
  const staked = { status: 'official' as const, durationDays: 7, stake: 700 }

  let active: Challenge | null = null
  let history: HistoryItem[] = []

  switch (kind) {
    case 'clear':
      saveMock({ seq: 47, active: null, history: [] })
      return
    case 'taste':
      active = base({ lockAt: now - Math.floor(len * 0.45) }) // ~half-full taste dot
      break
    case 'day': // day 3 open, days 1–2 kept
      active = base({ ...staked, stakedAt: now - Math.floor(len * 2.4), lockAt: now - Math.floor(len * 2.4), checkins: kept(2) })
      break
    case 'day2of3': // the bug-report state: 3-day run, day 2 open, day 1 banked (staked late in day 0)
      active = base({ status: 'official', durationDays: 3, stake: 300, stakedAt: now - Math.floor(len * 0.3), lockAt: now - Math.floor(len * 1.05), checkins: kept(1) })
      break
    case 'long': // day 24 of a 30-day run, 23 kept → the chain-cap ("+14 earlier", 2,300 NIM safe)
      active = base({ status: 'official', durationDays: 30, stake: 3000, stakedAt: now - Math.floor(len * 23.4), lockAt: now - Math.floor(len * 23.4), checkins: kept(23) })
      break
    case 'sealed': // day 3 just sealed
      active = base({ ...staked, stakedAt: now - Math.floor(len * 2.4), lockAt: now - Math.floor(len * 2.4), checkins: kept(3) })
      break
    case 'sealone': // day one, sealed → the SealShare merge
      active = base({ ...staked, stakedAt: now - Math.floor(len * 0.5), lockAt: now - Math.floor(len * 0.5), checkins: kept(1) })
      break
    case 'missed': // day 4 open, day 3 was missed (days 1–3 → only 1,2 kept)
      active = base({ ...staked, stakedAt: now - Math.floor(len * 4.3), lockAt: now - Math.floor(len * 4.3), checkins: kept(3) })
      break
    case 'banked-win':
      active = base({ ...staked, stakedAt: now - len * 8, lockAt: now - len * 8, checkins: kept(7) })
      break
    case 'banked-partial':
      active = base({ ...staked, stakedAt: now - len * 8, lockAt: now - len * 8, checkins: kept(4) })
      break
    case 'banked-wipeout':
      active = base({ ...staked, stakedAt: now - len * 8, lockAt: now - len * 8, checkins: [] })
      break
    case 'reup': // an ended win, plus a prior kept week → "14 days kept"
      active = base({ ...staked, stakedAt: now - len * 8, lockAt: now - len * 8, checkins: kept(7) })
      history = [{ id: 'r0', templateId: 'sugar', goal: t.goal, emoji: '🍩', outcome: 'banked', kept: 7, total: 7, stake: 700, endedAt: now - 14 * DAY }]
      break
    case 'lapsed': // a taste whose 24h passed with no stake
      active = base({ lockAt: now - Math.floor(len * 1.5) })
      break
    case 'archive':
      history = [
        { id: 'a1', templateId: 'sugar', goal: t.goal, emoji: '🍩', outcome: 'banked', kept: 7, total: 7, stake: 700, endedAt: now - 6 * DAY },
        { id: 'a2', templateId: 'run', goal: 'moving every day', emoji: '👟', outcome: 'partial', kept: 4, total: 7, stake: 700, endedAt: now - 8 * DAY },
        { id: 'a3', templateId: 'meditate', goal: 'meditating every day', emoji: '🧘', outcome: 'lapsed', kept: 0, total: 0, stake: 0, endedAt: now - 9 * DAY },
        { id: 'a4', templateId: 'cold', goal: 'taking a cold shower daily', emoji: '🚿', outcome: 'banked', kept: 7, total: 7, stake: 350, endedAt: now - 26 * DAY },
        { id: 'a5', templateId: 'read', goal: 'reading every day', emoji: '📚', outcome: 'wipeout', kept: 0, total: 7, stake: 700, endedAt: now - 40 * DAY },
      ]
      break
  }
  saveMock({ seq: 48, active, history })
}
