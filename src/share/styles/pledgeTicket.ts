// Style: "The Pledge" — the app's signature warm-editorial ticket, on canvas.
// Reads the brand layer (theme + copy) so it stays in lock-step with the app's CI.
// Other styles deliberately do NOT — they bring their own look.

import { theme, copy } from '../../brand/index.ts'
import { avatarColor, initials } from '../../product/store.ts'
import { drawAvatar, drawLines, fmtAmount, roundRectPath, wrapText } from '../draw.ts'
import type { CardStyle, PledgeCardData, ResultsCardData, Size } from '../types.ts'

const C = theme.color
const DISPLAY = theme.font.displayFamily
const UI = theme.font.uiFamily

function whosInLine(names: string[]): string {
  if (names.length <= 1) return copy.join.whosInOne(names[0] ?? 'You')
  if (names.length === 2) return copy.join.whosInTwo(names[0], names[1])
  return copy.join.whosInMany(names[0], names[1], names.length - 2)
}

/** Shared frame: paper background, drop-shadowed card, inset ink rule, brand row. */
function frame(ctx: CanvasRenderingContext2D, size: Size, s: (n: number) => number, meta: string) {
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, size.w, size.h)

  const m = s(56)
  const cw = size.w - 2 * m
  const ch = size.h - 2 * m
  ctx.save()
  ctx.shadowColor = 'rgba(28,24,19,0.28)'
  ctx.shadowBlur = s(70)
  ctx.shadowOffsetY = s(26)
  roundRectPath(ctx, m, m, cw, ch, s(44))
  ctx.fillStyle = C.paperCard
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.strokeStyle = C.lineStrong
  ctx.lineWidth = s(3)
  roundRectPath(ctx, m + s(28), m + s(28), cw - s(56), ch - s(56), s(26))
  ctx.stroke()
  ctx.restore()

  const px = m + s(80)
  const pw = cw - s(160)
  ctx.fillStyle = C.ink
  ctx.textAlign = 'left'
  ctx.font = `900 ${s(42)}px ${DISPLAY}`
  ctx.fillText(copy.cards.brand, px, m + s(110))
  ctx.fillStyle = C.inkFaint
  ctx.font = `700 ${s(24)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.textAlign = 'right'
  ctx.fillText(meta.toUpperCase(), px + pw, m + s(110))
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
  return { m, cw, ch, px, pw }
}

function waxSeal(
  ctx: CanvasRenderingContext2D,
  s: (n: number) => number,
  cx: number,
  cy: number,
  top: string,
  bottom: string,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-13 * Math.PI) / 180)
  ctx.beginPath()
  ctx.arc(0, 0, s(118), 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(251,246,236,0.5)'
  ctx.fill()
  ctx.lineWidth = s(6)
  ctx.strokeStyle = C.stake
  ctx.stroke()
  ctx.fillStyle = C.stake
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${s(40)}px ${UI}`
  ctx.fillText(top, 0, -s(14))
  ctx.font = `800 ${s(22)}px ${UI}`
  ctx.letterSpacing = `${s(5)}px`
  ctx.fillText(bottom, 0, s(34))
  ctx.letterSpacing = '0px'
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
}

function perforation(ctx: CanvasRenderingContext2D, s: (n: number) => number, m: number, cw: number, y: number) {
  ctx.save()
  ctx.strokeStyle = C.line
  ctx.lineWidth = s(3)
  ctx.setLineDash([s(14), s(12)])
  ctx.beginPath()
  ctx.moveTo(m + s(44), y)
  ctx.lineTo(m + cw - s(44), y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = C.paper
  for (const nx of [m, m + cw]) {
    ctx.beginPath()
    ctx.arc(nx, y, s(22), 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = s(3)
    ctx.strokeStyle = C.line
    ctx.stroke()
  }
  ctx.restore()
}

function avatarRow(
  ctx: CanvasRenderingContext2D,
  s: (n: number) => number,
  names: string[],
  x: number,
  y: number,
) {
  const r = s(34)
  const step = s(50)
  const shown = names.slice(0, 4)
  shown.forEach((n, i) => {
    const cx = x + r + i * step
    ctx.beginPath()
    ctx.arc(cx, y, r + s(5), 0, Math.PI * 2)
    ctx.fillStyle = C.paperCard
    ctx.fill()
    drawAvatar(ctx, initials(n), cx, y, r, avatarColor(n), '#fff', UI)
  })
  return x + r * 2 + (shown.length - 1) * step + s(24)
}

function drawPledge(ctx: CanvasRenderingContext2D, d: PledgeCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const { m, cw, ch, px, pw } = frame(ctx, size, s, copy.cards.pledgeMeta)

  // emoji
  ctx.textAlign = 'left'
  ctx.font = `${s(150)}px ${UI}`
  ctx.fillText(d.emoji, px, m + s(310))

  // kicker
  let y = m + s(420)
  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(34)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText("I'M PLEDGING TO", px, y)
  ctx.letterSpacing = '0px'

  // goal (big serif, up to 3 lines)
  ctx.fillStyle = C.ink
  ctx.font = `600 ${s(112)}px ${DISPLAY}`
  const goalLines = wrapText(ctx, d.goal || copy.cards.pledgeGoalFallback, pw).slice(0, 3)
  y = drawLines(ctx, goalLines, px, y + s(116), s(116))

  // "for N days."
  ctx.fillStyle = C.inkSoft
  ctx.font = `italic 500 ${s(56)}px ${DISPLAY}`
  ctx.fillText(copy.cards.pledgeForDays(d.durationDays), px, y + s(8))

  // stake
  y += s(124)
  ctx.fillStyle = C.stake
  ctx.font = `700 ${s(94)}px ${DISPLAY}`
  const stakeStr = `${d.stake} ${d.asset}`
  ctx.fillText(stakeStr, px, y)
  const sw = ctx.measureText(stakeStr).width
  ctx.fillStyle = C.inkSoft
  ctx.font = `600 ${s(38)}px ${UI}`
  ctx.fillText(`  ${copy.cards.pledgeOnLine}`, px + sw, y)

  // wax seal (top-right)
  waxSeal(ctx, s, m + cw - s(150), m + s(330), copy.cards.pledgeStamp, copy.cards.pledgeStampSub)

  // who's-in, grouped right under the stake (the info clusters up top, the lower
  // third becomes the "ticket stub": perforation + CTA + signature)
  const whoY = y + s(96)
  const ax = avatarRow(ctx, s, d.whosIn, px, whoY)
  ctx.fillStyle = C.ink
  ctx.font = `700 ${s(34)}px ${UI}`
  ctx.textBaseline = 'middle'
  ctx.fillText(whosInLine(d.whosIn), ax, whoY)
  ctx.textBaseline = 'alphabetic'

  perforation(ctx, s, m, cw, m + ch - s(280))

  // baked-in CTA — the invite *is* the image
  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(44)}px ${UI}`
  ctx.fillText('Doors are open — tap in 👀', px, m + ch - s(170))

  // footer: creator + line
  const fy = m + ch - s(92)
  drawAvatar(ctx, initials(d.creatorName), px + s(28), fy - s(8), s(28), avatarColor(d.creatorName), '#fff', UI)
  ctx.fillStyle = C.ink
  ctx.font = `800 ${s(36)}px ${UI}`
  ctx.textBaseline = 'middle'
  ctx.fillText(d.creatorName, px + s(72), fy - s(8))
  ctx.fillStyle = C.inkSoft
  ctx.font = `700 ${s(32)}px ${UI}`
  ctx.textAlign = 'right'
  ctx.fillText(copy.cards.pledgeFoot, m + cw - s(80), fy - s(8))
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawResults(ctx: CanvasRenderingContext2D, d: ResultsCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const perfect = d.isPerfectFinisher
  const { m, cw, ch, px, pw } = frame(ctx, size, s, perfect ? 'PERFECT WEEK' : 'THE WRAP')

  ctx.textAlign = 'left'
  ctx.font = `${s(150)}px ${UI}`
  ctx.fillText(d.emoji, px, m + s(310))

  let y = m + s(420)
  ctx.fillStyle = perfect ? C.go : C.stake
  ctx.font = `800 ${s(34)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText(perfect ? 'PERFECT WEEK ✅' : 'THAT WAS MY WEEK', px, y)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = C.ink
  ctx.font = `600 ${s(104)}px ${DISPLAY}`
  const goalLines = wrapText(ctx, d.goal, pw).slice(0, 2)
  y = drawLines(ctx, goalLines, px, y + s(110), s(108))

  // big payout
  y += s(96)
  ctx.fillStyle = perfect ? C.go : C.ink
  ctx.font = `700 ${s(150)}px ${DISPLAY}`
  const payStr = `${fmtAmount(d.payout)} ${d.asset}`
  ctx.fillText(payStr, px, y)
  ctx.fillStyle = C.inkSoft
  ctx.font = `600 ${s(40)}px ${UI}`
  ctx.fillText(copy.results.back(d.asset), px, y + s(58))

  // days pill
  ctx.fillStyle = C.inkSoft
  ctx.font = `700 ${s(40)}px ${UI}`
  ctx.fillText(`${d.daysCompleted}/${d.durationDays} days kept`, px, y + s(150))

  if (perfect) {
    ctx.fillStyle = C.gold
    ctx.font = `800 ${s(40)}px ${UI}`
    ctx.fillText('🏅 perfect-week club', px, y + s(214))
  }

  perforation(ctx, s, m, cw, m + ch - s(280))

  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(44)}px ${UI}`
  ctx.fillText('Run it back with me — tap in 👀', px, m + ch - s(170))

  const fy = m + ch - s(92)
  drawAvatar(ctx, initials(d.creatorName), px + s(28), fy - s(8), s(28), avatarColor(d.creatorName), '#fff', UI)
  ctx.fillStyle = C.ink
  ctx.font = `800 ${s(36)}px ${UI}`
  ctx.textBaseline = 'middle'
  ctx.fillText(d.creatorName, px + s(72), fy - s(8))
  ctx.textBaseline = 'alphabetic'
}

export const pledgeTicket: CardStyle = {
  id: 'ticket',
  name: 'The Pledge',
  swatch: { bg: C.paperCard, fg: C.ink, accent: C.stake },
  render(ctx, data, size) {
    if (data.kind === 'pledge') drawPledge(ctx, data, size)
    else drawResults(ctx, data, size)
  },
}
