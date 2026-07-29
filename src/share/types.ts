// The share-card system — the app's most important viral asset, built to be
// *pluggable*. A "style" is a self-contained skin that paints a card onto a canvas;
// the app ships a few, the picker (TikTok-style) lets users flip the whole look in
// one tap, and the registry is the seam for downloadable / bring-your-own / A-B
// styles later. Styles own their own palette + feel — they are NOT bound to the app
// brand (that's the point: diversity drives traction).

export type CardKind = 'pledge' | 'results'

/**
 * Per-day state of a participant's streak, in day order. The single shared vocabulary
 * for BOTH the in-app streak board (ProgressScreen) and the share-card grids, so a
 * missed day lands in the SAME position everywhere (not just "first N filled").
 */
export type DayMark = 'done' | 'missed' | 'today' | 'todo'

export interface PledgeCardData {
  kind: 'pledge'
  id: string // challenge id → the ticket "No." (cosmetic, stable)
  createdAt: number // → the "sealed" date
  emoji: string
  goal: string
  durationDays: number
  stake: number
  asset: string
  creatorName: string
  whosIn: string[] // participant names, for social proof
}

export interface ResultsCardData {
  kind: 'results'
  id: string
  createdAt: number
  emoji: string
  goal: string
  durationDays: number
  daysCompleted: number
  days: DayMark[] // per-day pattern (length durationDays) → grid places misses correctly
  payout: number
  asset: string
  isPerfectFinisher: boolean
  creatorName: string
}

export interface ProgressCardData {
  kind: 'progress'
  id: string
  createdAt: number
  emoji: string
  goal: string
  durationDays: number
  currentDay: number // 1-indexed — the day you're on
  daysKept: number // check-ins so far
  days: DayMark[] // per-day pattern (length durationDays) → grid places misses correctly
  stake: number
  asset: string
  creatorName: string
}

export type CardData = PledgeCardData | ResultsCardData | ProgressCardData

export interface Size {
  w: number
  h: number
}

/** Story format (9:16). Styles author in this design space and scale by w/1080. */
export const STORY: Size = { w: 1080, h: 1920 }

export interface CardStyle {
  id: string
  /** shown under the picker chip */
  name: string
  /** quick visual identity for the picker chip when a live thumb isn't enough */
  swatch: { bg: string; fg: string; accent: string }
  /**
   * Paint the card. Author coordinates in design space (1080-wide × 1920-tall) and
   * multiply by `size.w / 1080`, so the same code renders the full export AND the
   * tiny picker thumbnail. Fonts are guaranteed loaded before this is called.
   */
  render(ctx: CanvasRenderingContext2D, data: CardData, size: Size): void
}
