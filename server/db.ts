// Shared-state store for the MVP — SQLite via Node's built-in `node:sqlite` (zero deps;
// requires Node >= 22). This is what makes the journey work across devices: a friend
// opening the share link on their phone reads the same challenge the creator wrote.
//
// Identity is the Nimiq wallet address. Settlement reuses the frontend's deterministic
// `computeSettlement` so the math is identical on both sides.

import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeSettlement, type ParticipantPayout } from '../src/vault/settlement.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.STAKES_DB ?? join(HERE, 'stakes.db')

// sponsor/treasury-funded completion bonus per perfect finisher (matches the frontend).
const NIM_BONUS_PER_FINISHER = 10

export const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS challenges (
    id             TEXT PRIMARY KEY,
    goal           TEXT NOT NULL,
    emoji          TEXT NOT NULL,
    durationDays   INTEGER NOT NULL,
    stake          INTEGER NOT NULL,
    asset          TEXT NOT NULL,
    creatorAddress TEXT NOT NULL,
    creatorName    TEXT NOT NULL,
    createdAt      INTEGER NOT NULL,
    lockAt         INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'open'
  );
  CREATE TABLE IF NOT EXISTS participants (
    challengeId      TEXT NOT NULL,
    address          TEXT NOT NULL,
    name             TEXT NOT NULL,
    joinedAt         INTEGER NOT NULL,
    depositTxHash    TEXT,
    depositConfirmed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (challengeId, address)
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id          TEXT PRIMARY KEY,
    challengeId TEXT NOT NULL,
    address     TEXT NOT NULL,
    day         INTEGER NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    emoji       TEXT,
    at          INTEGER NOT NULL,
    cheers      INTEGER NOT NULL DEFAULT 0
  );
`)

const shortId = () => randomUUID().replace(/-/g, '').slice(0, 8)

// ---- writes ---------------------------------------------------------------

export interface NewChallenge {
  goal: string
  emoji: string
  durationDays: number
  stake: number
  asset: string
  creatorAddress: string
  creatorName: string
  lockAt: number
}

export function createChallenge(input: NewChallenge): string {
  const id = shortId()
  db.prepare(
    `INSERT INTO challenges
       (id, goal, emoji, durationDays, stake, asset, creatorAddress, creatorName, createdAt, lockAt, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
  ).run(
    id,
    input.goal,
    input.emoji,
    input.durationDays,
    input.stake,
    input.asset,
    input.creatorAddress,
    input.creatorName,
    Date.now(),
    input.lockAt,
  )
  return id
}

/** Stake-to-join (idempotent per address). Records the deposit tx for later verify. */
export function joinChallenge(
  challengeId: string,
  p: { address: string; name: string; depositTxHash?: string },
) {
  db.prepare(
    `INSERT INTO participants (challengeId, address, name, joinedAt, depositTxHash)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(challengeId, address) DO UPDATE SET
       name = excluded.name,
       depositTxHash = COALESCE(excluded.depositTxHash, participants.depositTxHash)`,
  ).run(challengeId, p.address, p.name, Date.now(), p.depositTxHash ?? null)
}

export function addCheckin(
  challengeId: string,
  c: { address: string; day: number; note: string; emoji?: string },
): string {
  const id = shortId()
  db.prepare(
    `INSERT INTO checkins (id, challengeId, address, day, note, emoji, at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, challengeId, c.address, c.day, c.note, c.emoji ?? null, Date.now())
  return id
}

export function cheer(checkinId: string) {
  db.prepare(`UPDATE checkins SET cheers = cheers + 1 WHERE id = ?`).run(checkinId)
}

// ---- reads ----------------------------------------------------------------

interface ChallengeRow {
  id: string
  goal: string
  emoji: string
  durationDays: number
  stake: number
  asset: string
  creatorAddress: string
  creatorName: string
  createdAt: number
  lockAt: number
  status: string
}
interface ParticipantRow {
  address: string
  name: string
  joinedAt: number
  depositTxHash: string | null
  depositConfirmed: number
}
interface CheckinRow {
  id: string
  address: string
  day: number
  note: string
  emoji: string | null
  at: number
  cheers: number
}

/** Full challenge view: row + participants + check-ins (what every screen reads). */
export function getChallenge(id: string) {
  const c = db.prepare(`SELECT * FROM challenges WHERE id = ?`).get(id) as ChallengeRow | undefined
  if (!c) return null
  const participants = db
    .prepare(
      `SELECT address, name, joinedAt, depositTxHash, depositConfirmed
         FROM participants WHERE challengeId = ? ORDER BY joinedAt ASC`,
    )
    .all(id) as ParticipantRow[]
  const checkins = db
    .prepare(
      `SELECT id, address, day, note, emoji, at, cheers
         FROM checkins WHERE challengeId = ? ORDER BY at ASC`,
    )
    .all(id) as CheckinRow[]
  return { ...c, participants, checkins }
}

/** Deterministic payouts from real check-ins (post-lock). Reuses the frontend math. */
export function getSettlement(id: string) {
  const view = getChallenge(id)
  if (!view) return null
  const results = view.participants.map((p) => ({
    account: p.address,
    daysCompleted: new Set(
      view.checkins.filter((c) => c.address === p.address).map((c) => c.day),
    ).size,
  }))
  const settlement = computeSettlement({
    stake: view.stake,
    durationDays: view.durationDays,
    results,
    nimBonusPerFinisher: NIM_BONUS_PER_FINISHER,
  })
  // attach display names back onto each payout row
  const nameByAddr = new Map(view.participants.map((p) => [p.address, p.name]))
  const perParticipant = settlement.perParticipant.map((r: ParticipantPayout) => ({
    ...r,
    name: nameByAddr.get(r.account) ?? r.account,
  }))
  return { ...settlement, perParticipant }
}
