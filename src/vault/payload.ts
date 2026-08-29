// The on-chain payload standard — "let's make some noise, on-chain" (ONBOARDING.md §1.8b + §4).
//
// Every transaction Stakes causes carries a human-readable, branded, ANONYMOUS tag in its public
// data field, so anyone who sees one tx in a block explorer knows where it came from and can type
// the domain:
//
//   stakes.day <verb>:<challengeId>[:<dayNumber>]
//
//   verbs: day (a check-in stamp, user → stamp address) · seed (treasury → new wallet) ·
//          official (the stake deposit, user → treasury) · banked (payout) · bonus · burned
//
// The challenge id is the opaque 8-hex id from the API, NEVER goal text, NEVER identity. The day
// is the human 1-based number ("day one" = 1). Whole payload ≤ 64 bytes (the protocol cap,
// MAX_BASIC_TX_RECIPIENT_DATA_SIZE, verified 2026-08-27).
//
// Pure + dependency-free so BOTH sides use it: the app (stamps, deposits) and the server
// (seeds, settlement tags, deposit attribution). Back-compat: the Cycle-I deposit tag
// `stakes:<id>` still parses as an `official` payload, so old deposits keep attributing.

export const STAMP_PREFIX = 'stakes.day'
export const MAX_DATA_BYTES = 64

export type StampVerb = 'day' | 'seed' | 'official' | 'banked' | 'bonus' | 'burned'
const VERBS: readonly StampVerb[] = ['day', 'seed', 'official', 'banked', 'bonus', 'burned']

const ID_RE = /^[A-Za-z0-9-]{1,36}$/

export interface StampPayload {
  verb: StampVerb
  challengeId: string
  /** 1-based day number; only on `day` payloads. */
  day?: number
}

export function buildPayload(verb: StampVerb, challengeId: string, day?: number): string {
  if (!VERBS.includes(verb)) throw new Error(`unknown payload verb: ${verb}`)
  if (!ID_RE.test(challengeId)) throw new Error('challenge id is not payload-safe')
  if (day != null && (!Number.isInteger(day) || day < 1 || day > 999)) throw new Error('day must be 1..999')
  const p = day == null ? `${STAMP_PREFIX} ${verb}:${challengeId}` : `${STAMP_PREFIX} ${verb}:${challengeId}:${day}`
  if (utf8Length(p) > MAX_DATA_BYTES) throw new Error('payload exceeds the 64-byte data cap')
  return p
}

/** Parse a tx data string. Accepts the standard AND the legacy `stakes:<id>` deposit tag. */
export function parsePayload(data: string): StampPayload | null {
  const m = /^stakes\.day (day|seed|official|banked|bonus|burned):([A-Za-z0-9-]{1,36})(?::([1-9]\d{0,2}))?$/.exec(data)
  if (m) return { verb: m[1] as StampVerb, challengeId: m[2], ...(m[3] != null ? { day: Number(m[3]) } : {}) }
  const legacy = /^stakes:([A-Za-z0-9-]{1,36})$/.exec(data)
  if (legacy) return { verb: 'official', challengeId: legacy[1] }
  return null
}

/** True if `data` is a stake deposit tag for `challengeId` (new standard or legacy). */
export function isDepositTag(data: string, challengeId: string): boolean {
  const p = parsePayload(data)
  return p?.verb === 'official' && p.challengeId === challengeId
}

function utf8Length(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length
  return unescape(encodeURIComponent(s)).length
}
