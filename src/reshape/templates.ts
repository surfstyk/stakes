// The curated challenge deck (v1 = curated only, no custom goal — JOURNEY §12.10).
//
// Product DATA, not chrome copy: the label / blurb / goal phrase live here (they are a
// per-language content catalog later — treated as "text is
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

// Nine cards, ordered so the deck opens on an invitation rather than a denial and no two
// neighbours come from the same part of life (decided with Hendrik, 2026-09-01).
// The first five were all solo self-optimisation and four of them were about giving something
// up — nothing on rest, attention, home or other people. Those four are the additions.
//
// `id` is an opaque key that outlives the copy: 'run' keeps its id although the card is now
// "Move every day", so challenges already on record still resolve.
export const TEMPLATES: Template[] = [
  { id: 'run', emoji: '👟', label: 'Move every day', blurb: 'However you like. Thirty minutes, every day.', goal: 'moving every day' },
  { id: 'sleep', emoji: '🌙', label: 'Lights out', blurb: 'In bed by the same time. Tomorrow starts the night before.', goal: 'getting to bed on time' },
  { id: 'sugar', emoji: '🍩', label: 'No sugar', blurb: 'Beat the afternoon crash. One clean day, then the next.', goal: 'going sugar-free' },
  { id: 'phone', emoji: '📵', label: 'Phone down', blurb: 'One hour a day, screen face down. See what comes back.', goal: 'putting the phone away daily' },
  { id: 'read', emoji: '📚', label: 'Read', blurb: 'Twenty pages a day. A book a fortnight, without trying.', goal: 'reading every day' },
  { id: 'cold', emoji: '🚿', label: 'Cold shower', blurb: 'Thirty seconds of cold. The rest of the day feels easy.', goal: 'taking a cold shower daily' },
  { id: 'tidy', emoji: '🧹', label: 'Ten minutes tidy', blurb: 'Ten minutes, one room. It stops piling up.', goal: 'tidying ten minutes a day' },
  { id: 'meditate', emoji: '🧘', label: 'Meditate', blurb: 'Ten quiet minutes before the day grabs you.', goal: 'meditating every day' },
  { id: 'reach', emoji: '💬', label: 'Reach out', blurb: "One message a day to someone you've been meaning to call.", goal: 'reaching out to someone' },
]

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function emojiFor(id: string): string {
  return templateById(id)?.emoji ?? '🔥'
}
