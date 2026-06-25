// The share-card system — the app's most important viral asset, built to be
// *pluggable*. A "style" is a self-contained skin that paints a card onto a canvas;
// the app ships a few, the picker (TikTok-style) lets users flip the whole look in
// one tap, and the registry is the seam for downloadable / bring-your-own / A-B
// styles later. Styles own their own palette + feel — they are NOT bound to the app
// brand (that's the point: diversity drives traction).

export type CardKind = 'pledge' | 'results'

export interface PledgeCardData {
  kind: 'pledge'
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
  emoji: string
  goal: string
  durationDays: number
  daysCompleted: number
  payout: number
  asset: string
  isPerfectFinisher: boolean
  creatorName: string
}

export type CardData = PledgeCardData | ResultsCardData

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
