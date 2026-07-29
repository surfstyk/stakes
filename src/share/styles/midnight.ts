// Style: "Midnight" — dark, modern, neon-mint accent with a serif headline. A wholly
// different feeling from the warm Pledge ticket — proof the system spans aesthetics.

import { brand } from '../../brand/index.ts'
import { avatarColor, initials } from '../../product/store.ts'
import { drawAvatar, drawLines, fmtAmount, wrapText } from '../draw.ts'
import type { CardStyle, PledgeCardData, ResultsCardData, Size } from '../types.ts'

const UI = 'Hanken Grotesk'
const DISPLAY = 'Fraunces'
const BG1 = '#18140f'
const BG2 = '#241c14'
const FG = '#f3ece0'
const FAINT = 'rgba(243,236,224,0.55)'
const MINT = '#5ff0a8'

function backdrop(ctx: CanvasRenderingContext2D, size: Size, glow: string) {
  const g = ctx.createLinearGradient(0, 0, 0, size.h)
  g.addColorStop(0, BG2)
  g.addColorStop(1, BG1)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size.w, size.h)
  const rg = ctx.createRadialGradient(size.w * 0.5, size.h * 0.12, 0, size.w * 0.5, size.h * 0.12, size.w * 0.9)
  rg.addColorStop(0, glow)
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, size.w, size.h)
}

function header(ctx: CanvasRenderingContext2D, s: (n: number) => number, px: number, tag: string) {
  ctx.fillStyle = FG
  ctx.textAlign = 'left'
  ctx.font = `900 ${s(42)}px ${DISPLAY}`
  ctx.fillText(brand.name, px, s(155))
  ctx.fillStyle = FAINT
  ctx.font = `700 ${s(24)}px ${UI}`
  ctx.letterSpacing = `${s(5)}px`
  ctx.fillText(tag.toUpperCase(), px, s(200))
  ctx.letterSpacing = '0px'
}

function divider(ctx: CanvasRenderingContext2D, s: (n: number) => number, px: number, w: number, y: number) {
  ctx.strokeStyle = 'rgba(243,236,224,0.16)'
  ctx.lineWidth = s(2)
  ctx.beginPath()
  ctx.moveTo(px, y)
  ctx.lineTo(px + w, y)
  ctx.stroke()
}

function avatarRow(ctx: CanvasRenderingContext2D, s: (n: number) => number, names: string[], x: number, y: number) {
  const r = s(32)
  const step = s(46)
  const shown = names.slice(0, 4)
  shown.forEach((n, i) => {
    const cx = x + r + i * step
    ctx.beginPath()
    ctx.arc(cx, y, r + s(5), 0, Math.PI * 2)
    ctx.fillStyle = BG1
    ctx.fill()
    drawAvatar(ctx, initials(n), cx, y, r, avatarColor(n), '#fff', UI)
  })
  return x + r * 2 + (shown.length - 1) * step + s(22)
}

function whoLine(names: string[]): string {
  if (names.length <= 1) return `${names[0] ?? 'You'} is in`
  if (names.length === 2) return `${names[0]} & ${names[1]} are in`
  return `${names[0]}, ${names[1]} +${names.length - 2} are in`
}

function footer(ctx: CanvasRenderingContext2D, s: (n: number) => number, size: Size, px: number, creator: string, cta: string) {
  ctx.fillStyle = MINT
  ctx.textAlign = 'left'
  ctx.font = `800 ${s(46)}px ${UI}`
  ctx.fillText(cta, px, size.h - s(180))

  const fy = size.h - s(100)
  drawAvatar(ctx, initials(creator), px + s(28), fy, s(28), avatarColor(creator), '#fff', UI)
  ctx.fillStyle = FG
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${s(36)}px ${UI}`
  ctx.fillText(creator, px + s(72), fy)
  ctx.textBaseline = 'alphabetic'
}

function drawPledge(ctx: CanvasRenderingContext2D, d: PledgeCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const px = s(90)
  const pw = size.w - 2 * px
  backdrop(ctx, size, 'rgba(95,240,168,0.10)')
  header(ctx, s, px, 'the pledge')

  ctx.textAlign = 'left'
  ctx.font = `${s(160)}px ${UI}`
  ctx.fillText(d.emoji, px, s(440))

  let y = s(560)
  ctx.fillStyle = MINT
  ctx.font = `800 ${s(32)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText("I'M PLEDGING TO", px, y)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = FG
  ctx.font = `600 ${s(116)}px ${DISPLAY}`
  const lines = wrapText(ctx, d.goal || 'do the thing', pw).slice(0, 3)
  y = drawLines(ctx, lines, px, y + s(120), s(118))

  ctx.fillStyle = FAINT
  ctx.font = `italic 500 ${s(54)}px ${DISPLAY}`
  ctx.fillText(`for ${d.durationDays} days`, px, y + s(6))

  y += s(150)
  ctx.fillStyle = MINT
  ctx.font = `700 ${s(100)}px ${DISPLAY}`
  const stakeStr = `${d.stake} ${d.asset}`
  ctx.fillText(stakeStr, px, y)
  const sw = ctx.measureText(stakeStr).width
  ctx.fillStyle = FAINT
  ctx.font = `600 ${s(38)}px ${UI}`
  ctx.fillText('  on the line', px + sw, y)

  divider(ctx, s, px, pw, size.h - s(330))
  const ax = avatarRow(ctx, s, d.whosIn, px, size.h - s(260))
  ctx.fillStyle = FG
  ctx.font = `700 ${s(34)}px ${UI}`
  ctx.textBaseline = 'middle'
  ctx.fillText(whoLine(d.whosIn), ax, size.h - s(260))
  ctx.textBaseline = 'alphabetic'

  footer(ctx, s, size, px, d.creatorName, 'Tap in before doors close 👀')
}

function drawResults(ctx: CanvasRenderingContext2D, d: ResultsCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const px = s(90)
  const pw = size.w - 2 * px
  const perfect = d.isPerfectFinisher
  backdrop(ctx, size, perfect ? 'rgba(95,240,168,0.14)' : 'rgba(243,236,224,0.06)')
  header(ctx, s, px, perfect ? 'perfect week' : 'the wrap')

  ctx.textAlign = 'left'
  ctx.font = `${s(160)}px ${UI}`
  ctx.fillText(d.emoji, px, s(440))

  let y = s(560)
  ctx.fillStyle = perfect ? MINT : FAINT
  ctx.font = `800 ${s(32)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText(perfect ? 'PERFECT WEEK ✅' : 'THAT WAS MY RUN', px, y)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = FG
  ctx.font = `600 ${s(104)}px ${DISPLAY}`
  const lines = wrapText(ctx, d.goal, pw).slice(0, 2)
  y = drawLines(ctx, lines, px, y + s(112), s(106))

  y += s(110)
  ctx.fillStyle = perfect ? MINT : FG
  ctx.font = `700 ${s(150)}px ${DISPLAY}`
  ctx.fillText(`${fmtAmount(d.payout)} ${d.asset}`, px, y)
  ctx.fillStyle = FAINT
  ctx.font = `600 ${s(40)}px ${UI}`
  ctx.fillText('back in your pocket', px, y + s(58))

  ctx.fillStyle = FAINT
  ctx.font = `700 ${s(40)}px ${UI}`
  ctx.fillText(`${d.daysCompleted}/${d.durationDays} days kept`, px, y + s(150))

  divider(ctx, s, px, pw, size.h - s(280))
  footer(ctx, s, size, px, d.creatorName, 'Run it back with me 👀')
}

export const midnight: CardStyle = {
  id: 'midnight',
  name: 'Midnight',
  swatch: { bg: BG1, fg: FG, accent: MINT },
  render(ctx, data, size) {
    if (data.kind === 'pledge') drawPledge(ctx, data, size)
    else if (data.kind === 'results') drawResults(ctx, data, size)
  },
}
