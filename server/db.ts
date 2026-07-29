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
    dayLengthMs    INTEGER NOT NULL DEFAULT 86400000,
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
  -- One row per challenge that settlement has touched. This is the DURABLE idempotency
  -- guard (the automated settler refuses to re-pay a 'done' challenge) AND the source of
  -- truth for a future "paid to your wallet" receipt in the UI. status:
  --   'broadcasting' → a signed plan was persisted; txs may be in flight (crash-recovery
  --                    re-broadcasts the SAME hashes — network-idempotent, never double-pays)
  --   'done'         → all txs broadcast
  --   'failed'       → a transient error (RPC down / underfunded); retried next tick
  CREATE TABLE IF NOT EXISTS settlements (
    challengeId TEXT PRIMARY KEY,
    status      TEXT NOT NULL,
    at          INTEGER NOT NULL,
    plan        TEXT NOT NULL DEFAULT '[]',
    sent        TEXT,
    error       TEXT,
    burnedPot   REAL NOT NULL DEFAULT 0,
    totalOut    REAL NOT NULL DEFAULT 0
  );
`)

// Migration: add dayLengthMs to challenges tables created before timed days (the
// CREATE above only applies to fresh DBs). Existing rows default to 24h.
try {
  db.exec(`ALTER TABLE challenges ADD COLUMN dayLengthMs INTEGER NOT NULL DEFAULT 86400000`)
} catch {
  /* column already exists */
}

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
  dayLengthMs: number // length of each check-in day/round (24h prod, minutes in test)
}

export function createChallenge(input: NewChallenge): string {
  const id = shortId()
  db.prepare(
    `INSERT INTO challenges
       (id, goal, emoji, durationDays, stake, asset, creatorAddress, creatorName, createdAt, lockAt, dayLengthMs, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
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
    input.dayLengthMs,
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

/** Record whether a participant's stake deposit is confirmed (+ the canonical tx hash). */
export function confirmDeposit(
  challengeId: string,
  address: string,
  depositTxHash: string | null,
  confirmed: boolean,
) {
  db.prepare(
    `UPDATE participants
        SET depositConfirmed = ?,
            depositTxHash = COALESCE(?, depositTxHash)
      WHERE challengeId = ? AND address = ?`,
  ).run(confirmed ? 1 : 0, depositTxHash, challengeId, address)
}

// ---- settlement state -----------------------------------------------------
// The durable record of what settlement has done, so the automated settler is idempotent
// across restarts and can recover an interrupted broadcast. See the `settlements` table.

export interface SettlementRecord {
  challengeId: string
  status: 'broadcasting' | 'done' | 'failed'
  at: number
  plan: string // JSON: [{ kind, to, nim, hash, hex }]
  sent: string | null // JSON: [{ kind, to, nim, hash }] once broadcast
  error: string | null
  burnedPot: number
  totalOut: number
}

export function getSettlementRecord(id: string): SettlementRecord | undefined {
  return db.prepare(`SELECT * FROM settlements WHERE challengeId = ?`).get(id) as SettlementRecord | undefined
}

/**
 * Persist the SIGNED plan and flip to 'broadcasting' BEFORE any tx goes out, so an
 * interrupted run recovers by re-broadcasting the very same (hash-idempotent) txs — it can
 * never re-sign at a fresh height and double-pay.
 */
export function startSettlement(id: string, planJson: string, burnedPot: number, totalOut: number) {
  db.prepare(
    `INSERT INTO settlements (challengeId, status, at, plan, burnedPot, totalOut)
     VALUES (?, 'broadcasting', ?, ?, ?, ?)
     ON CONFLICT(challengeId) DO UPDATE SET
       status='broadcasting', at=excluded.at, plan=excluded.plan,
       burnedPot=excluded.burnedPot, totalOut=excluded.totalOut, error=NULL`,
  ).run(id, Date.now(), planJson, burnedPot, totalOut)
}

export function finishSettlement(id: string, sentJson: string) {
  db.prepare(`UPDATE settlements SET status='done', at=?, sent=?, error=NULL WHERE challengeId=?`).run(
    Date.now(),
    sentJson,
    id,
  )
}

/**
 * Record a PRE-broadcast failure (verify/compute/build/underfunded) — retried on the next
 * tick as a fresh settle. Guarded to never downgrade a 'broadcasting' row (whose signed
 * plan must be preserved for crash-recovery, not overwritten).
 */
export function failSettlement(id: string, error: string) {
  db.prepare(
    `INSERT INTO settlements (challengeId, status, at, error) VALUES (?, 'failed', ?, ?)
     ON CONFLICT(challengeId) DO UPDATE SET status='failed', at=excluded.at, error=excluded.error
       WHERE settlements.status != 'broadcasting'`,
  ).run(id, Date.now(), error)
}

/**
 * Challenge ids whose run has fully elapsed and that are NOT yet settled ('done') — the
 * work queue for the automated settler. Includes never-touched, 'failed' (retry), and
 * 'broadcasting' (recover) challenges; excludes 'done'. Oldest-first.
 */
export function listEndedUnsettled(now = Date.now()): string[] {
  return (
    db
      .prepare(
        `SELECT c.id FROM challenges c
           LEFT JOIN settlements s ON s.challengeId = c.id
          WHERE (c.lockAt + c.durationDays * c.dayLengthMs) <= ?
            AND (s.status IS NULL OR s.status != 'done')
          ORDER BY c.lockAt ASC`,
      )
      .all(now) as { id: string }[]
  ).map((r) => r.id)
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
  dayLengthMs: number
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

/**
 * Deterministic payouts from real check-ins (post-lock). Reuses the frontend math.
 * Only participants whose stake deposit is CONFIRMED are settled (money flow: settlement
 * counts confirmed deposits only) — callers should verify first (see server/verify.ts).
 */
export function getSettlement(id: string) {
  const view = getChallenge(id)
  if (!view) return null
  const staked = view.participants.filter((p) => p.depositConfirmed)
  const results = staked.map((p) => ({
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
