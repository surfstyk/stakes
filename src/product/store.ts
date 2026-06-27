import type { Asset, CompletionResult } from '../vault/types.ts'
import { getVault } from '../vault/index.ts'
import { getNimiq } from '../lib/nimiq.ts'
import { safeRandomId } from '../lib/id.ts'
import { DEV_TOOLS } from '../lib/flags.ts'

// The store is the seam between the screens and the shared-state backend. Reads/writes
// go through the same-origin `/api` (Vite proxy in dev, Caddy reverse_proxy in prod) so
// the journey works ACROSS devices: a friend opening the share link on their phone reads
// the same challenge the creator wrote. The function names are unchanged from the old
// localStorage store — only the internals (and that the mutating reads are now async).
//
// Identity is the Nimiq wallet address (SDK `listAccounts`), with a per-device dev
// fallback so the whole loop still runs in a plain browser. The address is the participant
// id everywhere; `name` is display only. The "money" still flows through the swappable
// StakeVault (src/vault/) — mock today, real custodial-NIM next phase.

export interface Template {
  id: string
  emoji: string
  label: string
  hint: string
  /** phrase that completes "I'm ___" on the pledge card */
  goal: string
}

export const TEMPLATES: Template[] = [
  { id: 'run', emoji: '🏃', label: 'Run daily', hint: 'every day', goal: 'running every day' },
  { id: 'sugar', emoji: '🍩', label: 'No sugar', hint: 'cut it out', goal: 'going sugar-free' },
  { id: 'meditate', emoji: '🧘', label: 'Meditate', hint: '10 min', goal: 'meditating every day' },
  { id: 'cold', emoji: '🚿', label: 'Cold shower', hint: 'brrr', goal: 'taking a cold shower daily' },
  { id: 'read', emoji: '📚', label: 'Read', hint: 'an hour', goal: 'reading every day' },
  { id: 'custom', emoji: '✍️', label: 'Custom', hint: 'your own', goal: '' },
]

export type WindowPreset = 'tonight' | 'tomorrow' | 'monday'

export const WINDOW_PRESETS: { id: WindowPreset; label: string; sub: string; ms: number }[] = [
  { id: 'tonight', label: 'Tonight', sub: 'tight crew', ms: 6 * 3600_000 },
  { id: 'tomorrow', label: 'Tomorrow', sub: '~24h', ms: 24 * 3600_000 },
  { id: 'monday', label: 'Next Mon', sub: 'go wide', ms: 0 /* computed */ },
]

// Test mode (enable with ?test in the URL) compresses the real-time bits so the
// whole arc is testable in minutes instead of days. Persisted so it survives the
// router rewriting the query string.
const TEST_KEY = 'stakes.testmode'
const TEST_WINDOW_MS = 2 * 60_000 // 2-minute join window in test mode
export function isTestMode(): boolean {
  if (!DEV_TOOLS) return false // test mode doesn't exist in the public build
  try {
    return localStorage.getItem(TEST_KEY) === '1'
  } catch {
    return false
  }
}
export function setTestMode(on: boolean) {
  try {
    localStorage.setItem(TEST_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

// ---- shared-state types (mirror the API view in server/db.ts) --------------

export interface Participant {
  address: string // the participant id (Nimiq wallet address, or a dev pseudo-address)
  name: string // display only
  joinedAt: number
  depositTxHash?: string | null
  depositConfirmed: number
}

export interface CheckIn {
  id: string
  address: string // who checked in (resolve to a name via the participant list)
  day: number // 0-indexed
  note: string
  emoji?: string | null
  at: number
  cheers: number
}

export interface ChallengeRecord {
  id: string
  goal: string
  emoji: string
  durationDays: number
  stake: number
  asset: Asset
  creatorAddress: string
  creatorName: string
  createdAt: number
  lockAt: number
  status: string
  participants: Participant[]
  checkins: CheckIn[]
}

// ---- API client ------------------------------------------------------------

const API_BASE = '/api'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body && typeof body.error === 'string') msg = body.error
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ---- identity (Nimiq wallet address, with a dev fallback) ------------------

const DEV_ADDR_KEY = 'stakes.devAddress'
const NAME_KEY = 'stakes.name'
let cachedAddress: string | null = null

/**
 * The current user's participant id. Inside Nimiq Pay this is the real wallet
 * address (`listAccounts`); in a plain browser it's a stable per-device pseudo-address
 * so create → join → check-in → settle still runs end-to-end without a wallet.
 * Cached for the session.
 */
export async function getMyAddress(): Promise<string> {
  if (cachedAddress) return cachedAddress
  if (typeof window !== 'undefined' && window.nimiqPay) {
    try {
      const nim = await getNimiq(4000)
      const accounts = await nim.listAccounts()
      if (accounts?.[0]) return (cachedAddress = accounts[0])
    } catch {
      /* not reachable / declined — fall back to the dev identity */
    }
  }
  return (cachedAddress = devAddress())
}

function devAddress(): string {
  try {
    const existing = localStorage.getItem(DEV_ADDR_KEY)
    if (existing) return existing
    const a = 'DEV-' + safeRandomId().replace(/-/g, '').slice(0, 12).toUpperCase()
    localStorage.setItem(DEV_ADDR_KEY, a)
    return a
  } catch {
    return 'DEV-ANON'
  }
}

/** The display name the user last used (for prefilling the name field). */
export function getMyName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'You'
  } catch {
    return 'You'
  }
}
export function setMyName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name || 'You')
  } catch {
    /* ignore */
  }
}

/** Resolve a participant's display name within a challenge (falls back to a short address). */
export function nameFor(rec: ChallengeRecord, address: string): string {
  const p = rec.participants.find((q) => q.address === address)
  if (p?.name) return p.name
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-3)}` : address
}

// ---- "my challenges" breadcrumb (local, per-device) ------------------------
// A lightweight local index so the create screen can offer a one-tap "resume" of the
// challenge you last created/joined ON THIS DEVICE — which is exactly the right scope
// for a resume affordance. Source of truth for the challenge itself is the backend.

const MINE_KEY = 'stakes.mine.v1'
export interface MineEntry {
  id: string
  emoji: string
  goal: string
  at: number
}
function loadMine(): MineEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(MINE_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function saveMine(list: MineEntry[]) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota/private-mode */
  }
}
function rememberMine(e: MineEntry) {
  const list = loadMine().filter((m) => m.id !== e.id)
  list.unshift(e)
  saveMine(list.slice(0, 12))
}
function forgetMine(id: string) {
  saveMine(loadMine().filter((m) => m.id !== id))
}
/** Challenges this device created/joined, newest first (for the resume banner). */
export function myChallenges(): MineEntry[] {
  return loadMine().sort((a, b) => b.at - a.at)
}

// ---- challenges ------------------------------------------------------------

function nextMondayMs(from: number): number {
  const d = new Date(from)
  const day = d.getDay() // 0 Sun..6 Sat
  const delta = ((8 - day) % 7) || 7 // days until next Monday (at least 1)
  d.setDate(d.getDate() + delta)
  d.setHours(0, 0, 0, 0)
  return d.getTime() - from
}

export interface CreateInput {
  templateId: string
  goal: string
  emoji: string
  durationDays: number
  stake: number
  asset: Asset
  creatorName: string
  window: WindowPreset
}

/** Create a challenge on the backend. Returns the new challenge id. */
export async function createChallenge(input: CreateInput): Promise<string> {
  const now = Date.now()
  const windowMs = isTestMode()
    ? TEST_WINDOW_MS
    : input.window === 'monday'
      ? nextMondayMs(now)
      : (WINDOW_PRESETS.find((w) => w.id === input.window)?.ms ?? 24 * 3600_000)

  const creatorAddress = await getMyAddress()
  const creatorName = input.creatorName || 'You'
  const { id } = await api<{ id: string }>('/challenges', {
    method: 'POST',
    body: JSON.stringify({
      goal: input.goal,
      emoji: input.emoji,
      durationDays: input.durationDays,
      stake: input.stake,
      asset: input.asset,
      creatorAddress,
      creatorName,
      windowMs,
    }),
  })
  setMyName(creatorName)
  rememberMine({ id, emoji: input.emoji, goal: input.goal, at: now })
  return id
}

/** Full challenge view (+ participants, check-ins). null if it doesn't exist. */
export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
  try {
    return await api<ChallengeRecord>(`/challenges/${id}`)
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null
    console.warn('getChallenge failed', e)
    return null // a transient failure shouldn't dead-end the UI; screens show "not found"
  }
}

/**
 * Best-effort rollback of the local breadcrumb if a create flow aborts (e.g. the
 * creator declines their own stake). The backend has no delete for the MVP — an
 * unstaked, unshared orphan is harmless and a retry just makes a fresh challenge.
 */
export function deleteChallenge(id: string) {
  forgetMine(id)
}

/** Stake-to-join: routes the money through the vault, then records the participant. */
export async function joinChallenge(id: string, name: string): Promise<ChallengeRecord> {
  const address = await getMyAddress()
  const display = name || 'You'
  const current = await getChallenge(id)
  if (!current) throw new Error('Challenge not found')
  const receipt = await getVault().deposit({ challengeId: id, amount: current.stake, asset: current.asset })
  const updated = await api<ChallengeRecord>(`/challenges/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({ address, name: display, depositTxHash: receipt.ref }),
  })
  setMyName(display)
  rememberMine({ id, emoji: updated.emoji, goal: updated.goal, at: Date.now() })
  return updated
}

// ---- check-ins -------------------------------------------------------------

/** Post a text+emoji check-in, then return the refreshed challenge view. */
export async function checkIn(
  challengeId: string,
  input: { address: string; day: number; note: string; emoji?: string },
): Promise<ChallengeRecord> {
  await api(`/challenges/${challengeId}/checkins`, {
    method: 'POST',
    body: JSON.stringify({
      address: input.address,
      day: input.day,
      note: input.note,
      emoji: input.emoji,
    }),
  })
  const updated = await getChallenge(challengeId)
  if (!updated) throw new Error('Challenge not found')
  return updated
}

/** Add a cheer to a check-in (fire-and-forget; the caller updates optimistically). */
export async function cheer(challengeId: string, checkinId: string): Promise<void> {
  await api(`/challenges/${challengeId}/checkins/${checkinId}/cheer`, { method: 'POST' })
}

export function daysCompletedFor(rec: ChallengeRecord, address: string): number {
  return new Set(rec.checkins.filter((c) => c.address === address).map((c) => c.day)).size
}

/** Build the per-participant completion input for computeSettlement (keyed by address). */
export function buildResults(rec: ChallengeRecord): CompletionResult[] {
  return rec.participants.map((p) => ({
    account: p.address,
    daysCompleted: daysCompletedFor(rec, p.address),
  }))
}

// ---- display helpers (pure; also used by the share-card renderers) ---------

const AV_COLORS = ['#ef2d06', '#0f7a44', '#c98a16', '#2b6cb0', '#8a3ffc', '#d6336c']
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AV_COLORS[h % AV_COLORS.length]
}
export function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

export function goalEmoji(templateId: string): string {
  return TEMPLATES.find((t) => t.id === templateId)?.emoji ?? '🔥'
}

// ---- first-run welcome (per-device, local) ---------------------------------
const WELCOME_KEY = 'stakes.welcome.seen'
export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return false
  }
}
export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    /* ignore */
  }
}
