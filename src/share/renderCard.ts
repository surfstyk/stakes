import { STORY, type CardData, type CardStyle, type Size } from './types.ts'

// Render engine. Canvas (not DOM snapshot) so it's bulletproof inside the Nimiq Pay
// WebView — no web-font inlining / CORS surprises. The catch with canvas is that
// fonts must be *loaded* before we paint, or text falls back to a system font; we
// gate every render on that.

let fontsReady: Promise<void> | null = null

/** Load the display + UI font weights the styles use, once. Safe to await repeatedly. */
export function ensureCardFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
      if (!fonts) return
      const want = [
        '500 100px Fraunces',
        '600 100px Fraunces',
        '700 100px Fraunces',
        '900 100px Fraunces',
        'italic 600 100px Fraunces',
        "500 100px 'Hanken Grotesk'",
        "700 100px 'Hanken Grotesk'",
        "800 100px 'Hanken Grotesk'",
      ]
      try {
        await Promise.all(want.map((f) => fonts.load(f)))
        await fonts.ready
      } catch {
        /* fall back to whatever's available */
      }
    })()
  }
  return fontsReady
}

/** Paint `style` for `data` into `canvas` at `size`. Awaits font readiness first. */
export async function renderCard(
  canvas: HTMLCanvasElement,
  style: CardStyle,
  data: CardData,
  size: Size = STORY,
): Promise<void> {
  await ensureCardFonts()
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, size.w, size.h)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  style.render(ctx, data, size)
}
