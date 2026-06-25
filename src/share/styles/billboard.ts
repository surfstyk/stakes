// Style: "Billboard" — loud, full-bleed, all-caps poster energy. Brings its own look
// (not the app theme) on purpose: variety is what earns reach. Only the product name
// stays constant (brand.name); the rest of the voice is this skin's own.

import { brand } from '../../brand/index.ts'
import { initials } from '../../product/store.ts'
import { drawAvatar, drawLines, roundRectPath, wrapText } from '../draw.ts'
import type { CardStyle, PledgeCardData, ResultsCardData, Size } from '../types.ts'

const UI = 'Hanken Grotesk'
const RED = '#ff3a14'
const RED_DEEP = '#b81d03'
const GREEN = '#10b15f'
const GREEN_DEEP = '#0a7a41'
const WHITE = '#ffffff'

function flood(ctx: CanvasRenderingContext2D, size: Size, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, size.h)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size.w, size.h)
}

function header(ctx: CanvasRenderingContext2D, s: (n: number) => number, px: number, tag: string) {
  ctx.fillStyle = WHITE
  ctx.textAlign = 'left'
  ctx.font = `900 ${s(42)}px ${UI}`
  ctx.fillText(brand.name, px, s(155))
  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.font = `800 ${s(26)}px ${UI}`
  ctx.letterSpacing = `${s(5)}px`
  ctx.fillText(tag.toUpperCase(), px, s(202))
  ctx.restore()
  ctx.letterSpacing = '0px'
}

function whoLine(names: string[]): string {
  if (names.length <= 1) return `${(names[0] ?? 'YOU').toUpperCase()} IS IN`
  return `${names.length} ARE IN`
}

function ctaFooter(
  ctx: CanvasRenderingContext2D,
  s: (n: number) => number,
  size: Size,
  px: number,
  creator: string,
  cta: string,
) {
  const fy = size.h - s(120)
  drawAvatar(ctx, initials(creator), px + s(30), fy, s(30), 'rgba(255,255,255,0.22)', WHITE, UI)
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${s(38)}px ${UI}`
  ctx.textAlign = 'left'
  ctx.fillText(creator, px + s(78), fy)
  ctx.font = `900 ${s(40)}px ${UI}`
  ctx.textAlign = 'right'
  ctx.fillText(cta, size.w - px, fy)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawPledge(ctx: CanvasRenderingContext2D, d: PledgeCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const px = s(90)
  const pw = size.w - 2 * px
  flood(ctx, size, RED, RED_DEEP)
  header(ctx, s, px, 'the pledge')

  ctx.textAlign = 'left'
  ctx.font = `${s(176)}px ${UI}`
  ctx.fillText(d.emoji, px, s(450))

  ctx.fillStyle = WHITE
  ctx.font = `900 ${s(128)}px ${UI}`
  const lines = wrapText(ctx, (d.goal || 'do the thing').toUpperCase(), pw).slice(0, 3)
  let y = drawLines(ctx, lines, px, s(640), s(122))

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.font = `800 ${s(50)}px ${UI}`
  ctx.fillText(`FOR ${d.durationDays} DAYS`, px, y + s(24))
  ctx.restore()

  // stake pill
  y += s(132)
  ctx.font = `900 ${s(54)}px ${UI}`
  const stakeTxt = `${d.stake} ${d.asset} ON THE LINE`
  const tw = ctx.measureText(stakeTxt).width
  const padX = s(48)
  const pillH = s(112)
  roundRectPath(ctx, px, y, tw + padX * 2, pillH, pillH / 2)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.fillStyle = RED_DEEP
  ctx.textBaseline = 'middle'
  ctx.fillText(stakeTxt, px + padX, y + pillH / 2 + s(2))
  ctx.textBaseline = 'alphabetic'

  // big watch-me — flows right under the stake so goal + stake + hook read as one block
  y += pillH + s(150)
  ctx.fillStyle = WHITE
  ctx.font = `900 ${s(120)}px ${UI}`
  ctx.fillText('WATCH ME 👀', px, y)

  // social proof, anchored at the bottom above the footer
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.font = `800 ${s(40)}px ${UI}`
  ctx.fillText(whoLine(d.whosIn), px, size.h - s(210))
  ctx.restore()

  ctaFooter(ctx, s, size, px, d.creatorName, 'TAP IN →')
}

function drawResults(ctx: CanvasRenderingContext2D, d: ResultsCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const px = s(90)
  const pw = size.w - 2 * px
  const perfect = d.isPerfectFinisher
  flood(ctx, size, perfect ? GREEN : RED, perfect ? GREEN_DEEP : RED_DEEP)
  header(ctx, s, px, perfect ? 'perfect week' : 'the wrap')

  ctx.textAlign = 'left'
  ctx.font = `${s(176)}px ${UI}`
  ctx.fillText(d.emoji, px, s(450))

  ctx.fillStyle = WHITE
  ctx.font = `900 ${s(132)}px ${UI}`
  const head = perfect ? 'PERFECT WEEK' : (d.goal || 'MY WEEK').toUpperCase()
  const lines = wrapText(ctx, head, pw).slice(0, 3)
  let y = drawLines(ctx, lines, px, s(640), s(126))

  if (perfect) {
    ctx.font = `900 ${s(150)}px ${UI}`
    ctx.fillText('✅', px, y + s(120))
    y += s(120)
  }

  // payout pill
  y += s(60)
  ctx.font = `900 ${s(58)}px ${UI}`
  const payTxt = `${d.payout} ${d.asset} BACK`
  const tw = ctx.measureText(payTxt).width
  const padX = s(48)
  const pillH = s(120)
  roundRectPath(ctx, px, y, tw + padX * 2, pillH, pillH / 2)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.fillStyle = perfect ? GREEN_DEEP : RED_DEEP
  ctx.textBaseline = 'middle'
  ctx.fillText(payTxt, px + padX, y + pillH / 2 + s(2))
  ctx.textBaseline = 'alphabetic'

  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = WHITE
  ctx.font = `800 ${s(46)}px ${UI}`
  ctx.fillText(`${d.daysCompleted}/${d.durationDays} DAYS KEPT`, px, size.h - s(240))
  ctx.restore()

  ctaFooter(ctx, s, size, px, d.creatorName, 'RUN IT BACK →')
}

export const billboard: CardStyle = {
  id: 'billboard',
  name: 'Billboard',
  swatch: { bg: RED, fg: WHITE, accent: WHITE },
  render(ctx, data, size) {
    if (data.kind === 'pledge') drawPledge(ctx, data, size)
    else drawResults(ctx, data, size)
  },
}
