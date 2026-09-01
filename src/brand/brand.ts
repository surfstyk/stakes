// Brand identity — name, wordmark, voice.
//
// The working title "Stakes" is NOT final (see CONCEPT §1). It lives here as a
// single field so a rename touches only this file: the wordmark, every card's
// branding, share text, and the document title all read from `brand.name`.

export interface Brand {
  /** product name — wordmark, card branding, share text, document title */
  name: string
  /** completes "<name> — <tagline>" in the document title */
  tagline: string
  /** the wordmark shows the name preceded by an accent dot when true */
  hasDot: boolean
  /** earmarked deck lines for hero/marketing surfaces (CONCEPT §14) */
  deckLines: string[]
}

export const brand: Brand = {
  name: 'Stakes',
  tagline: 'Stake a day. Keep it, keep the money.',
  hasDot: true,
  deckLines: [
    'Win your moment. Bank the day.',
    'Stake a day on a promise to yourself.',
    'Keep the day, keep the money.',
    'The money is at risk, not up for grabs.',
    'Kept honest by friends, not surveillance.',
  ],
}
