// The sphere's job: tap → a curated line for the moment you're in. Self-contained: no AI,
// no server, no keys — a tiny DETERMINISTIC matcher over the in-repo library
// (sphere-content.json, relaunched to the studio voice, v2.0). Supports, never verifies,
// judges or watches (the DNA line): the dot keeps no score.
//
// The library is organised by MOMENT (the eight the dot answers). The app knows some
// moments from state — a sealed day is a `win`, a fresh miss is a `slip` — and asks for the
// rest (the weak-moment set) with a small chip row. `win` and `slip` are context-deployed
// and never leak into a plain "what's up?" tap.

import content from './sphere-content.json'

export type Moment = 'crave' | 'start' | 'grind' | 'doubt' | 'tired' | 'win' | 'slip' | 'any'
export type WeakMoment = 'crave' | 'start' | 'grind' | 'doubt' | 'tired'

// The moments the dot offers on a mid-day tap. `win` (a sealed day) and `slip` (a fresh
// miss) are deployed by context, never chosen from this menu.
export const WEAK_MOMENTS: WeakMoment[] = ['crave', 'start', 'grind', 'doubt', 'tired']

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

/** A line for the moment you're in, preferring the challenge flavour. Deterministic in
 *  (dayIndex, tap) so a re-tap re-rolls predictably (the pop-over contract). `win`/`slip`
 *  surface only when explicitly asked for; a plain tap can never draw one. */
export function pickLine(templateId: string, dayIndex: number, tap: number, moment: Moment = 'any'): Pick {
  const cat = CATEGORY[templateId] ?? 'any'
  const inMoment = (l: Line) => l.moment === moment
  // the asked moment, flavour-first; then the asked moment at any flavour
  let pool = LINES.filter((l) => inMoment(l) && (l.category === cat || l.category === 'any'))
  if (pool.length === 0) pool = LINES.filter(inMoment)
  // fall back to the plain baseline voice, never to the context-only win/slip lines
  if (pool.length === 0) pool = LINES.filter((l) => l.moment === 'any')
  if (pool.length === 0) pool = LINES.filter((l) => l.moment !== 'win' && l.moment !== 'slip')

  const i = (((dayIndex * 7 + tap) % pool.length) + pool.length) % pool.length
  const l = pool[i]
  return { text: l.text, source: l.source }
}
