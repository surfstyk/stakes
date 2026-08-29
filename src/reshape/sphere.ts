// The sphere's MVP job: tap → a curated, self-contained pick (a line for a weak moment).
//
// No AI, no server, no keys — a tiny DETERMINISTIC matcher over the in-repo library
// (sphere-content.json, 200 lines). Supports-never-verifies/judges/watches (the DNA line):
// the sphere is a mirror in your corner, it keeps no score. The richer AI chat is a later
// gated phase; this is the shippable Cycle-II job.

import content from './sphere-content.json'

interface Line {
  id: string
  moment: string
  category: string
  phase: string
  source: string | null
  text: string
}

const LINES = (content as { lines: Line[] }).lines

// challenge template → the content library's flavour axis (unmapped → the big 'any' pool)
const CATEGORY: Record<string, string> = { sugar: 'sugar', run: 'move', cold: 'cold' }

export interface Pick {
  text: string
  source: string | null
}

/** A line for a weak moment, chosen by challenge flavour + where in the run you are.
 *  Deterministic in (day, tap) so a re-tap re-rolls predictably (the pop-over contract). */
export function pickLine(templateId: string, dayIndex: number, total: number, tap: number): Pick {
  const cat = CATEGORY[templateId] ?? 'any'
  const t = total || 7
  const phase = t <= 1 ? 'any' : dayIndex < Math.ceil(t / 3) ? 'early' : dayIndex >= Math.ceil((2 * t) / 3) ? 'late' : 'mid'
  const match = (l: Line) => l.moment !== 'win' && (l.category === cat || l.category === 'any') && (l.phase === phase || l.phase === 'any')

  let pool = LINES.filter(match)
  if (pool.length === 0) pool = LINES.filter((l) => l.moment !== 'win')
  if (pool.length === 0) pool = LINES

  const i = (((dayIndex * 7 + tap) % pool.length) + pool.length) % pool.length
  const l = pool[i]
  return { text: l.text, source: l.source }
}
