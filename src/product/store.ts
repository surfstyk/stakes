import type { Asset, Challenge, CompletionResult } from '../vault/types.ts'
import { getVault } from '../vault/index.ts'
import { safeRandomId } from '../lib/id.ts'

// Local, no-backend store so the create→join ignition loop runs end-to-end on a
// single device. Challenges persist to localStorage so a share link (?c=<id>)
// resolves across reloads/tabs. The "money" goes through the swappable StakeVault
// (mock for now) — see src/vault/.

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

export interface Joiner {
  name: string
  at: number
}

export interface CheckIn {
  id: string
  account: string // participant name (demo handle)
  day: number // 0-indexed
  note: string
  emoji?: string
  at: number
  cheers: number
}

export interface ChallengeRecord extends Challenge {
  goal: string
  emoji: string
  creatorName: string
  createdAt: number
  lockAt: number
  participants: Joiner[]
  checkins: CheckIn[]
}

const KEY = 'stakes.challenges.v1'

function load(): Record<string, ChallengeRecord> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
function save(all: Record<string, ChallengeRecord>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* ignore quota/private-mode */
  }
}

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

export function createChallenge(input: CreateInput): ChallengeRecord {
  const now = Date.now()
  const windowMs = isTestMode()
    ? TEST_WINDOW_MS
    : input.window === 'monday'
      ? nextMondayMs(now)
      : (WINDOW_PRESETS.find((w) => w.id === input.window)?.ms ?? 24 * 3600_000)

  const rec: ChallengeRecord = {
    id: safeRandomId().slice(0, 8),
    title: input.goal,
    goal: input.goal,
    emoji: input.emoji,
    durationDays: input.durationDays,
    stake: input.stake,
    asset: input.asset,
    creatorName: input.creatorName || 'You',
    createdAt: now,
    lockAt: now + windowMs,
    participants: [], // the creator becomes a participant when they stake (see CreateScreen)
    checkins: [],
  }

  const all = load()
  all[rec.id] = rec
  save(all)
  setMe(rec.creatorName)
  return rec
}

export function getChallenge(id: string): ChallengeRecord | null {
  return load()[id] ?? null
}

export function deleteChallenge(id: string) {
  const all = load()
  delete all[id]
  save(all)
}

/** Challenges the current user is already a participant in, newest first. */
export function myChallenges(): ChallengeRecord[] {
  const me = getMe()
  return Object.values(load())
    .filter((c) => c.participants.some((p) => p.name === me))
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Stake-to-join: routes the money through the vault, then records the joiner. */
export async function joinChallenge(id: string, name: string): Promise<ChallengeRecord> {
  const all = load()
  const rec = all[id]
  if (!rec) throw new Error('Challenge not found')
  await getVault().deposit({ challengeId: id, amount: rec.stake, asset: rec.asset })
  rec.participants = [...rec.participants, { name: name || 'You', at: Date.now() }]
  save(all)
  setMe(name || 'You')
  return rec
}

// For a convincing solo demo, seed a couple of friends so "who's in" isn't empty.
export function seedDemoFriends(id: string) {
  const all = load()
  const rec = all[id]
  if (!rec || rec.participants.length > 1) return
  rec.participants.push({ name: 'Maya', at: Date.now() }, { name: 'Tom', at: Date.now() })
  save(all)
}

// avatar accent from a name
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

// ---- "current user" (demo handle) -----------------------------------------
const ME_KEY = 'stakes.me'
export function getMe(): string {
  try {
    return localStorage.getItem(ME_KEY) || 'You'
  } catch {
    return 'You'
  }
}
export function setMe(name: string) {
  try {
    localStorage.setItem(ME_KEY, name || 'You')
  } catch {
    /* ignore */
  }
}

// ---- check-ins ------------------------------------------------------------
// Photos stay in-memory only (never localStorage) to avoid quota bloat; they
// live for the session and are looked up by check-in id.
const photoCache = new Map<string, string>()
export function getCheckinPhoto(id: string): string | undefined {
  return photoCache.get(id)
}

export function checkIn(
  challengeId: string,
  input: { account: string; day: number; note: string; emoji?: string; photo?: string },
): ChallengeRecord {
  const all = load()
  const rec = all[challengeId]
  if (!rec) throw new Error('Challenge not found')
  rec.checkins = rec.checkins ?? []
  const ci: CheckIn = {
    id: safeRandomId().slice(0, 8),
    account: input.account,
    day: input.day,
    note: input.note,
    emoji: input.emoji,
    at: Date.now(),
    cheers: 0,
  }
  rec.checkins.push(ci)
  if (input.photo) photoCache.set(ci.id, input.photo)
  save(all)
  return rec
}

export function cheer(challengeId: string, checkinId: string): ChallengeRecord {
  const all = load()
  const rec = all[challengeId]
  if (!rec) throw new Error('Challenge not found')
  const ci = (rec.checkins ?? []).find((c) => c.id === checkinId)
  if (ci) ci.cheers += 1
  save(all)
  return rec
}

export function daysCompletedFor(rec: ChallengeRecord, account: string): number {
  const days = new Set((rec.checkins ?? []).filter((c) => c.account === account).map((c) => c.day))
  return days.size
}

/** Build the per-participant completion input for computeSettlement. */
export function buildResults(rec: ChallengeRecord): CompletionResult[] {
  return rec.participants.map((p) => ({
    account: p.name,
    daysCompleted: daysCompletedFor(rec, p.name),
  }))
}

// For a believable solo demo, give the seeded friends some history: Maya goes
// perfect, Tom misses the last two days (so results show a real mix). Runs once.
const MOCK_NOTES = ['done ✅', 'tough one today', 'nearly skipped — glad I didn’t', 'easy today', 'streak alive']
export function seedMockActivity(id: string) {
  const all = load()
  const rec = all[id]
  if (!rec) return
  rec.checkins = rec.checkins ?? []
  if (rec.checkins.some((c) => c.account === 'Maya' || c.account === 'Tom')) return
  const names = rec.participants.map((p) => p.name)
  const D = rec.durationDays
  const add = (name: string, upto: number) => {
    for (let d = 0; d < upto; d++) {
      rec.checkins.push({
        id: safeRandomId().slice(0, 8),
        account: name,
        day: d,
        note: MOCK_NOTES[d % MOCK_NOTES.length],
        at: Date.now() - (upto - d) * 90_000,
        cheers: (d % 3) + 1,
      })
    }
  }
  if (names.includes('Maya')) add('Maya', D)
  if (names.includes('Tom')) add('Tom', Math.max(0, D - 2))
  save(all)
}
