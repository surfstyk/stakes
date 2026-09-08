// Theme tokens — the single source of truth for the visual identity ("The Pledge").
//
// Warm editorial, not dark-crypto: cream paper, ink, one vermilion accent for
// action/urgency, deep green reserved for "you're in / money confirmed", gold held
// in reserve. This file *is* the CI: every value here is injected onto :root as a
// CSS custom property at boot (see apply.ts) AND read directly by the canvas
// share-image renderer (canvas can't read CSS variables). Edit this to re-skin the
// whole app. The matching values in product.css are static fallbacks only.

export interface Theme {
  color: {
    paper: string
    paperCard: string
    paperSunk: string
    ink: string
    inkSoft: string
    inkFaint: string
    line: string
    lineStrong: string
    stake: string // vermilion — action + urgency
    stakeDeep: string
    stakeTint: string
    go: string // deep green — confirmed / money
    goDeep: string // deeper green — money labels / on-chain chip
    goTint: string
    proceed: string // ink-blue — the "commit / proceed" CTA (the reshape's forward button)
    proceedDeep: string
    proceedTint: string
    grey: string // quiet grey — a missed/burned day (never vermilion; the bead reserves that)
    cream: string // text on saturated buttons
    gold: string
    nimiqBlue: string // Nimiq brand — the "Nimiq" wordmark on the on-chain proof
    nimiqGoldA: string // Nimiq brand — the gold hexagon gradient (logo = gold, not blue)
    nimiqGoldB: string
    onDark: string // plain white, for text on dark surfaces (result card)
  }
  font: {
    display: string // full CSS stack
    ui: string
    data: string // IBM Plex Mono — the "data" role: eyebrows, labels, numbers on the record
    displayFamily: string // bare family name — canvas ctx.font needs this, not the stack
    uiFamily: string
  }
  radius: { card: string; btn: string }
  shadow: { card: string; pop: string }
}

export const theme: Theme = {
  color: {
    paper: '#f5f2eb',
    paperCard: '#fffdf7',
    paperSunk: '#efebe3',
    ink: '#1c1813',
    inkSoft: '#6c6256',
    inkFaint: '#a89c88',
    line: 'rgba(28, 24, 19, 0.14)',
    lineStrong: 'rgba(28, 24, 19, 0.9)',
    stake: '#ef2d06',
    stakeDeep: '#c12104',
    stakeTint: '#fbe2d7',
    go: '#0c5f35',
    goDeep: '#004721',
    goTint: '#dcefe0',
    proceed: '#27354d',
    proceedDeep: '#1e2a3d',
    proceedTint: '#dfe4ec',
    grey: '#c8c0b0',
    cream: '#fbf6ec',
    gold: '#c98a16',
    nimiqBlue: '#1f2348',
    nimiqGoldA: '#ec991c',
    nimiqGoldB: '#e9b213',
    onDark: '#ffffff',
  },
  font: {
    display: "'Young Serif', Georgia, 'Times New Roman', serif",
    ui: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    data: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    displayFamily: 'Young Serif',
    uiFamily: 'Hanken Grotesk',
  },
  radius: { card: '22px', btn: '16px' },
  shadow: {
    card: '0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 18px 40px -22px rgba(28, 24, 19, 0.5)',
    pop: '0 24px 60px -24px rgba(239, 45, 6, 0.55)',
  },
}
