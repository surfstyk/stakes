// The sphere's job: tap → a curated line for the moment. Self-contained: no AI, no server,
// no keys — a tiny DETERMINISTIC matcher over the in-repo library (sphere-content.json,
// relaunched to the studio voice, v2.0). Supports, never verifies, judges or watches (the
// DNA line): the dot keeps no score.
//
// The library is organised by MOMENT. The app deploys the two moments it can read from
// state — a sealed day is a `win`, a fresh miss is a `slip` — and a plain tap hands a broad
// supportive line. `win` and `slip` are context-only and never leak into a plain tap.
// (A richer "which moment are you in?" UX is deferred to a dedicated UX session.)

import content from './sphere-content.json'

export type Moment = 'crave' | 'start' | 'grind' | 'doubt' | 'tired' | 'win' | 'slip' | 'any'

interface Line {
  id: string
  moment: string
  category: string
  phase: string
  source: string | null
  text: string
}

const LINES = (content as { lines: Line[] }).lines

// challenge template → the library's flavour axis (unmapped → the plain baseline voice).
// Most lines are flavour-agnostic ('any'); a few are seasoned to a challenge.
const CATEGORY: Record<string, string> = { sugar: 'sugar', run: 'move', cold: 'cold' }

export interface Pick {
  text: string
  source: string | null
}

/** A line for the moment, preferring the challenge flavour. A specific `moment` (win/slip
 *  from context) draws that pool; a plain tap (no moment) draws the broad baseline — any
 *  supportive line that is NOT one of the context-only moments, so win/slip never surface
 *  unasked. Deterministic in (dayIndex, tap) so a re-tap re-rolls predictably. */
export function pickLine(templateId: string, dayIndex: number, tap: number, moment?: Moment): Pick {
  const cat = CATEGORY[templateId] ?? 'any'
  const notContext = (l: Line) => l.moment !== 'win' && l.moment !== 'slip'
  const inScope = moment ? (l: Line) => l.moment === moment : notContext
  let pool = LINES.filter((l) => inScope(l) && (l.category === cat || l.category === 'any'))
  if (pool.length === 0) pool = LINES.filter(inScope)
  if (pool.length === 0) pool = LINES.filter(notContext)
  // The sphere is rendered on every commit/day screen; a throw here blanks the whole app. So this
  // stays TOTAL: an empty pool (never expected) yields a calm baseline, and non-finite inputs (a
  // challenge with a bad clock → NaN dayIndex) are coerced, not indexed with (NaN % 0 = NaN).
  if (pool.length === 0) return { text: 'One day at a time.', source: null }
  const d = Number.isFinite(dayIndex) ? Math.trunc(dayIndex) : 0
  const t = Number.isFinite(tap) ? Math.trunc(tap) : 0
  const i = (((d * 7 + t) % pool.length) + pool.length) % pool.length
  const l = pool[i]
  return { text: l.text, source: l.source }
}
