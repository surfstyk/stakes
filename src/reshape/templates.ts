// The curated challenge deck (v1 = curated only, no custom goal — JOURNEY §12.10).
//
// Product DATA, not chrome copy: the label / blurb / goal phrase live here (they are a
// per-language content catalog later, per BUILD-HANDOFF §1 bucket 1 — treated as "text is
// data, not code", never machine-translated). `blurb` is the swipe-card line; `goal` is the
// phrase that completes the on-record card ("going sugar-free").

export interface Template {
  id: string
  emoji: string
  label: string
  /** the swipe-deck card line — intriguing, one breath */
  blurb: string
  /** completes the goal phrase on cards ("going sugar-free") */
  goal: string
}

export const TEMPLATES: Template[] = [
  { id: 'sugar', emoji: '🍩', label: 'No sugar', blurb: 'Beat the afternoon crash. One clean day, then the next.', goal: 'going sugar-free' },
  { id: 'run', emoji: '🏃', label: 'Run daily', blurb: 'Lace up once a day. Rain or shine, you just go.', goal: 'running every day' },
  { id: 'meditate', emoji: '🧘', label: 'Meditate', blurb: 'Ten quiet minutes before the day grabs you.', goal: 'meditating every day' },
  { id: 'cold', emoji: '🚿', label: 'Cold shower', blurb: 'Thirty seconds of cold. The rest of the day feels easy.', goal: 'taking a cold shower daily' },
  { id: 'read', emoji: '📚', label: 'Read', blurb: 'Twenty pages a day. A book a fortnight, without trying.', goal: 'reading every day' },
]

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function emojiFor(id: string): string {
  return templateById(id)?.emoji ?? '🔥'
}
