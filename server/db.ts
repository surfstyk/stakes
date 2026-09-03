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
import { computeSettlement, finisherBonus, type ParticipantPayout } from '../src/vault/settlement.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.STAKES_DB ?? join(HERE, 'stakes.db')


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
    status         TEXT NOT NULL DEFAULT 'window',
    -- the reshape (Cycle II): goal identity, the deposit moment, the archive stamp, a display Nº
    templateId     TEXT,
    stakedAt       INTEGER,
    endedAt        INTEGER,
    seq            INTEGER NOT NULL DEFAULT 0
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
    cheers      INTEGER NOT NULL DEFAULT 0,
    stampTxHash TEXT,
    stampStatus TEXT
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

// Migrations: ALTER only affects DBs created before a column existed (the CREATE above
// applies to fresh DBs). Each is idempotent — a duplicate-column error is swallowed.
const migrate = (sql: string) => {
  try {
    db.exec(sql)
  } catch {
    /* column already exists */
  }
}
migrate(`ALTER TABLE challenges ADD COLUMN dayLengthMs INTEGER NOT NULL DEFAULT 86400000`)
migrate(`ALTER TABLE challenges ADD COLUMN templateId TEXT`)
migrate(`ALTER TABLE challenges ADD COLUMN stakedAt INTEGER`)
migrate(`ALTER TABLE challenges ADD COLUMN endedAt INTEGER`)
migrate(`ALTER TABLE challenges ADD COLUMN seq INTEGER NOT NULL DEFAULT 0`)
migrate(`ALTER TABLE checkins ADD COLUMN stampTxHash TEXT`)
migrate(`ALTER TABLE checkins ADD COLUMN stampStatus TEXT`)

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
  templateId?: string // the goal identity (reshape) — null for legacy/CLI rows
  status?: string // defaults to 'window' (the reshape taste); the settler ignores status
  stakedAt?: number | null
}

export function createChallenge(input: NewChallenge): string {
  const id = shortId()
  const seq = (db.prepare(`SELECT COALESCE(MAX(seq), 47) AS m FROM challenges`).get() as { m: number }).m + 1
  db.prepare(
    `INSERT INTO challenges
       (id, goal, emoji, durationDays, stake, asset, creatorAddress, creatorName, createdAt, lockAt, dayLengthMs, status, templateId, stakedAt, seq)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    input.status ?? 'window',
    input.templateId ?? null,
    input.stakedAt ?? null,
    seq,
  )
  return id
}

// ---- reshape lifecycle (Cycle II): window → official → ended|lapsed ----------

/** Convert a taste (window) into a staked run: set the length, stake, and deposit moment. */
export function setOfficial(id: string, p: { durationDays: number; stake: number; stakedAt: number }) {
  db.prepare(`UPDATE challenges SET status='official', durationDays=?, stake=?, stakedAt=? WHERE id=? AND status='window'`).run(
    p.durationDays,
    p.stake,
    p.stakedAt,
    id,
  )
}

/** Retire a run into history with its terminal outcome status ('ended' | 'lapsed' | 'settled'). */
export function archiveChallenge(id: string, status: 'ended' | 'lapsed' | 'settled') {
  db.prepare(`UPDATE challenges SET status=?, endedAt=? WHERE id=?`).run(status, Date.now(), id)
}

/** The mis-tap exit: delete a taste that was never staked (J4). No-op once a deposit exists. */
export function deleteWindowChallenge(id: string): boolean {
  const r = db
    .prepare(`DELETE FROM challenges WHERE id=? AND status='window' AND NOT EXISTS (SELECT 1 FROM participants WHERE challengeId=id)`)
    .run(id)
  return Number(r.changes) > 0
}

/** The one live run for an address (≤1 by the invariant), or undefined. */
export function getActiveRowFor(address: string): ChallengeRow | undefined {
  return db
    .prepare(`SELECT * FROM challenges WHERE creatorAddress=? AND status IN ('window','official') ORDER BY createdAt DESC LIMIT 1`)
    .get(address) as ChallengeRow | undefined
}

export function countActiveFor(address: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM challenges WHERE creatorAddress=? AND status IN ('window','official')`).get(address) as { n: number }).n
}

/** Every retired run + attempt for an address, newest first (the Archive). */
export function getHistoryRowsFor(address: string): ChallengeRow[] {
  return db
    .prepare(`SELECT * FROM challenges WHERE creatorAddress=? AND status IN ('ended','lapsed','settled') ORDER BY COALESCE(endedAt, createdAt) DESC`)
    .all(address) as ChallengeRow[]
}

/** A participant's check-ins with the stamp fields (reshape serialization). */
export function reshapeCheckinsFor(challengeId: string, address: string): { day: number; at: number; stampTxHash: string | null; stampStatus: string | null }[] {
  return db
    .prepare(`SELECT day, at, stampTxHash, stampStatus FROM checkins WHERE challengeId=? AND address=? ORDER BY day ASC`)
    .all(challengeId, address) as { day: number; at: number; stampTxHash: string | null; stampStatus: string | null }[]
}

/** Distinct kept days for one participant (the Banked / history outcome). */
export function keptDaysFor(challengeId: string, address: string): number {
  return (db.prepare(`SELECT COUNT(DISTINCT day) AS n FROM checkins WHERE challengeId=? AND address=?`).get(challengeId, address) as { n: number }).n
}

/** Started-this-week counts by template (the deck's honest social proof). Never invented. */
export function statsStartedThisWeek(sinceMs: number): Record<string, number> {
  const rows = db
    .prepare(`SELECT templateId, COUNT(*) AS n FROM challenges WHERE templateId IS NOT NULL AND createdAt >= ? GROUP BY templateId`)
    .all(sinceMs) as { templateId: string; n: number }[]
  const out: Record<string, number> = {}
  for (const r of rows) out[r.templateId] = r.n
  return out
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
  c: { address: string; day: number; note: string; emoji?: string; stampTxHash?: string | null; stampStatus?: string | null },
): string {
  const id = shortId()
  db.prepare(
    `INSERT INTO checkins (id, challengeId, address, day, note, emoji, at, stampTxHash, stampStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, challengeId, c.address, c.day, c.note, c.emoji ?? null, Date.now(), c.stampTxHash ?? null, c.stampStatus ?? null)
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
/**
 * Finisher bonuses committed since `since` (records that are 'done' or 'broadcasting' — a signed,
 * persisted plan is money already spoken for). The settler reads this to enforce the bonus policy's
 * own invariant (one bonus per wallet per day) plus a global daily budget — without it a 1-day run
 * settled + re-created back-to-back farms the bonus every settler tick (audit H1).
 */
export function listBonusesSince(since: number): { to: string; nim: number; at: number }[] {
  const rows = db
    .prepare(`SELECT at, plan, sent FROM settlements WHERE status IN ('done','broadcasting') AND at >= ?`)
    .all(since) as { at: number; plan: string; sent: string | null }[]
  const out: { to: string; nim: number; at: number }[] = []
  for (const r of rows) {
    try {
      const txs = JSON.parse(r.sent ?? r.plan ?? '[]') as { kind: string; to: string; nim: number }[]
      for (const t of txs) if (t.kind === 'bonus' && t.nim > 0) out.push({ to: t.to, nim: t.nim, at: r.at })
    } catch {
      /* malformed record: ignore */
    }
  }
  return out
}

export function failSettlement(id: string, error: string) {
  db.prepare(
    `INSERT INTO settlements (challengeId, status, at, error) VALUES (?, 'failed', ?, ?)
     ON CONFLICT(challengeId) DO UPDATE SET status='failed', at=excluded.at, error=excluded.error
       WHERE settlements.status != 'broadcasting'`,
  ).run(id, Date.now(), error)
}

/**
 * The settler's work queue: challenge ids NOT yet settled ('done') whose outcome is final —
 * either the run has fully elapsed, or every participant has already kept every day (a perfect
 * run is deterministic the moment the last day is sealed, so the payoff lands right then —
 * PRE-BUILD-SENSE-CHECK J9). Includes never-touched, 'failed' (retry) and 'broadcasting'
 * (recover) challenges. Oldest-first.
 */
export function listEndedUnsettled(now = Date.now()): string[] {
  return (
    db
      .prepare(
        `SELECT c.id FROM challenges c
           LEFT JOIN settlements s ON s.challengeId = c.id
          WHERE (s.status IS NULL OR s.status != 'done')
            -- a taste (durationDays = 0) has nothing to settle and would otherwise count as
            -- "elapsed" the instant it exists, putting every taste ever created on the queue forever
            AND c.durationDays > 0
            AND (
              (c.lockAt + c.durationDays * c.dayLengthMs) <= ?
              OR (
                EXISTS (SELECT 1 FROM participants p WHERE p.challengeId = c.id)
                AND NOT EXISTS (
                  SELECT 1 FROM participants p
                   WHERE p.challengeId = c.id
                     AND (SELECT COUNT(DISTINCT k.day) FROM checkins k
                           WHERE k.challengeId = c.id AND k.address = p.address) < c.durationDays
                )
              )
            )
          ORDER BY c.lockAt ASC`,
      )
      .all(now) as { id: string }[]
  ).map((r) => r.id)
}

// ---- reads ----------------------------------------------------------------

export interface ChallengeRow {
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
  templateId: string | null
  stakedAt: number | null
  endedAt: number | null
  seq: number
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
    nimBonusPerFinisher: finisherBonus(view.stake), // the shared policy (% of stake, capped)
  })
  // attach display names back onto each payout row
  const nameByAddr = new Map(view.participants.map((p) => [p.address, p.name]))
  const perParticipant = settlement.perParticipant.map((r: ParticipantPayout) => ({
    ...r,
    name: nameByAddr.get(r.account) ?? r.account,
  }))
  return { ...settlement, perParticipant }
}

// ---- seeds — the silent sliver at "Start day one" (ONBOARDING.md §3 step 1, §7.5) ----------
// The API queues a seed (one per wallet, rate-limited); the isolated settle service — the only
// process with the treasury key — signs + broadcasts it on its next tick (server/seed-due.ts).
// Sized for ~a month of dust stamps; it is never a stake and never counts toward the metric.

db.exec(`
  CREATE TABLE IF NOT EXISTS seeds (
    address     TEXT PRIMARY KEY,
    challengeId TEXT NOT NULL,
    ipHash      TEXT,
    luna        INTEGER NOT NULL,
    requestedAt INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    attempts    INTEGER NOT NULL DEFAULT 0,
    txHash      TEXT,
    sentAt      INTEGER,
    error       TEXT
  );
`)

export interface SeedRow {
  address: string
  challengeId: string
  ipHash: string | null
  luna: number
  requestedAt: number
  status: 'pending' | 'sent'
  attempts: number
  txHash: string | null
  sentAt: number | null
  error: string | null
}

/** Queue a seed for a wallet. Idempotent per address: a second request is a no-op ('exists'). */
export function requestSeed(s: { address: string; challengeId: string; ipHash?: string | null; luna: number }): 'queued' | 'exists' {
  const r = db
    .prepare(
      `INSERT INTO seeds (address, challengeId, ipHash, luna, requestedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(address) DO NOTHING`,
    )
    .run(s.address, s.challengeId, s.ipHash ?? null, s.luna, Date.now())
  return Number(r.changes) > 0 ? 'queued' : 'exists'
}

export function getSeed(address: string): SeedRow | undefined {
  return db.prepare(`SELECT * FROM seeds WHERE address = ?`).get(address) as SeedRow | undefined
}

/** Seeds requested since `since` — overall, or by one requester (the abuse box). */
export function countSeedsSince(since: number, ipHash?: string): number {
  const row = ipHash
    ? (db.prepare(`SELECT COUNT(*) AS n FROM seeds WHERE requestedAt >= ? AND ipHash = ?`).get(since, ipHash) as { n: number })
    : (db.prepare(`SELECT COUNT(*) AS n FROM seeds WHERE requestedAt >= ?`).get(since) as { n: number })
  return row.n
}

/** Pending seeds for the settle service to send (bounded attempts so a bad row can't wedge the loop). */
export function listPendingSeeds(limit = 50, maxAttempts = 5): SeedRow[] {
  return db
    .prepare(`SELECT * FROM seeds WHERE status = 'pending' AND attempts < ? ORDER BY requestedAt ASC LIMIT ?`)
    .all(maxAttempts, limit) as SeedRow[]
}

export function markSeedSent(address: string, txHash: string) {
  db.prepare(`UPDATE seeds SET status='sent', txHash=?, sentAt=?, error=NULL WHERE address=?`).run(txHash, Date.now(), address)
}

export function markSeedFailed(address: string, error: string) {
  db.prepare(`UPDATE seeds SET attempts = attempts + 1, error = ? WHERE address = ?`).run(error, address)
}
