// Style: "Receipt" — a thermal-print betting slip. Monospace, torn edges, a barcode.
// Brings its OWN look (dark surround + a white receipt) — variety is what earns reach.
// Leans hard into the betting-slip metaphor; novel and high-contrast, reads at thumb size.

import { brand, milestone } from '../../brand/index.ts'
import { fmtAmount, wrapText } from '../draw.ts'
import type { CardStyle, PledgeCardData, ResultsCardData, Size } from '../types.ts'

const MONO = "'Courier New', ui-monospace, monospace"
const BG = '#221d17'
const PAPER = '#fbfaf5'
const INK = '#1a1714'
const FAINT = '#9a8f7e'

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function ticketNo(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return String((h % 9000) + 1000)
}
function dateStr(ms: number): string {
  const d = new Date(ms)
  return `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} '${String(d.getFullYear()).slice(-2)}`
}

/** Dark surround + a white receipt strip with torn (zigzag) top & bottom edges. */
function slip(ctx: CanvasRenderingContext2D, size: Size, s: (n: number) => number) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, size.w, size.h)

  const sx = s(150)
  const sw = size.w - 2 * sx
  const top = s(150)
  const bot = size.h - s(150)
  const tooth = s(28)
  const teeth = Math.round(sw / tooth)
  const tw = sw / teeth

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = s(60)
  ctx.shadowOffsetY = s(24)
  ctx.beginPath()
  ctx.moveTo(sx, top)
  for (let i = 0; i < teeth; i++) {
    ctx.lineTo(sx + (i + 0.5) * tw, top - tooth)
    ctx.lineTo(sx + (i + 1) * tw, top)
  }
  ctx.lineTo(sx + sw, bot)
  for (let i = 0; i < teeth; i++) {
    ctx.lineTo(sx + sw - (i + 0.5) * tw, bot + tooth)
    ctx.lineTo(sx + sw - (i + 1) * tw, bot)
  }
  ctx.lineTo(sx, top)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.restore()

  return { sx, sw, top, bot, px: sx + s(56), iw: sw - s(112), cx: size.w / 2 }
}

function rule(ctx: CanvasRenderingContext2D, s: (n: number) => number, px: number, iw: number, y: number, dashed = false, color = INK) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = s(3)
  if (dashed) ctx.setLineDash([s(10), s(9)])
  ctx.beginPath()
  ctx.moveTo(px, y)
  ctx.lineTo(px + iw, y)
  ctx.stroke()
  ctx.restore()
}

/** label .......... value (dotted leader, mono). */
function leader(ctx: CanvasRenderingContext2D, s: (n: number) => number, px: number, iw: number, y: number, label: string, value: string, bold = false) {
  ctx.fillStyle = INK
  ctx.font = `${bold ? 700 : 400} ${s(34)}px ${MONO}`
  ctx.textAlign = 'left'
  ctx.fillText(label, px, y)
  ctx.textAlign = 'right'
  ctx.fillText(value, px + iw, y)
  const lw = ctx.measureText(label).width
  const vw = ctx.measureText(value).width
  ctx.save()
  ctx.strokeStyle = FAINT
  ctx.lineWidth = s(3)
  ctx.setLineDash([s(2), s(10)])
  ctx.beginPath()
  ctx.moveTo(px + lw + s(14), y - s(8))
  ctx.lineTo(px + iw - vw - s(14), y - s(8))
  ctx.stroke()
  ctx.restore()
  ctx.textAlign = 'left'
}

/** A faux barcode whose bar widths are derived from the id (stable, scannable look). */
function barcode(ctx: CanvasRenderingContext2D, s: (n: number) => number, cx: number, y: number, w: number, h: number, id: string) {
  let seed = 0
  for (let i = 0; i < id.length; i++) seed = (seed * 131 + id.charCodeAt(i)) >>> 0
  let x = cx - w / 2
  const end = cx + w / 2
  ctx.fillStyle = INK
  let i = 0
  while (x < end) {
    seed = (seed * 1103515245 + 12345) >>> 0
    const bw = s(3) + (seed % 4) * s(3)
    if (i % 2 === 0) ctx.fillRect(x, y, bw, h)
    x += bw
    i++
  }
}

function drawPledge(ctx: CanvasRenderingContext2D, d: PledgeCardData, size: Size) {
  const s = (n: number) => (n * size.w) / 1080
  const { px, iw, cx, bot } = slip(ctx, size, s)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  let y = s(290)
  ctx.font = `700 ${s(70)}px ${MONO}`
  ctx.fillText(brand.name.toUpperCase(), cx, y)
  y += s(44)
  ctx.font = `700 ${s(26)}px ${MONO}`
  ctx.fillText('* PLEDGE RECEIPT *', cx, y)

  // emoji
  y += s(150)
  ctx.font = `${s(130)}px ${MONO}`
  ctx.fillText(d.emoji, cx, y)
  y += s(70)

  rule(ctx, s, px, iw, y)
  y += s(56)
  ctx.font = `400 ${s(28)}px ${MONO}`
  ctx.textAlign = 'left'
  ctx.fillText(`NO. ${ticketNo(d.id)}`, px, y)
  ctx.textAlign = 'right'
  ctx.fillText(dateStr(d.createdAt), px + iw, y)
  y += s(40)
  rule(ctx, s, px, iw, y, true)

  // item
  y += s(72)
  ctx.textAlign = 'left'
  ctx.fillStyle = FAINT
  ctx.font = `700 ${s(26)}px ${MONO}`
  ctx.fillText('ITEM', px, y)
  y += s(54)
  ctx.fillStyle = INK
  ctx.font = `700 ${s(46)}px ${MONO}`
  const goalLines = wrapText(ctx, (d.goal || 'the thing').toUpperCase(), iw).slice(0, 2)
  goalLines.forEach((ln) => {
    ctx.fillText(ln, px, y)
    y += s(54)
  })
  ctx.font = `400 ${s(30)}px ${MONO}`
  ctx.fillStyle = FAINT
  ctx.fillText(`FOR ${d.durationDays} DAYS`, px, y)

  // stake + total
  y += s(74)
  rule(ctx, s, px, iw, y, true)
  y += s(64)
  leader(ctx, s, px, iw, y, 'STAKE', `${d.stake} ${d.asset}`)
  y += s(40)
  rule(ctx, s, px, iw, y)
  y += s(64)
  leader(ctx, s, px, iw, y, 'ON THE LINE', `${d.stake} ${d.asset}`, true)
  y += s(40)
  rule(ctx, s, px, iw, y)

  // party + hook
  y += s(80)
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `700 ${s(30)}px ${MONO}`
  ctx.fillText(`*** ${d.whosIn.length} ALREADY IN ***`, cx, y)

  // barcode footer
  barcode(ctx, s, cx, bot - s(250), iw * 0.82, s(120), d.id)
  ctx.fillStyle = INK
  ctx.font = `700 ${s(34)}px ${MONO}`
  ctx.fillText('DOORS OPEN — TAP IN 👀', cx, bot - s(86))
  ctx.textAlign = 'left'
}

function drawResults(ctx: CanvasRenderingContext2D, d: ResultsCardData, size: Size) {
  const s = (n: number) => (n * size.w) / 1080
  const { px, iw, cx, bot } = slip(ctx, size, s)
  const perfect = d.isPerfectFinisher

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  let y = s(290)
  ctx.font = `700 ${s(70)}px ${MONO}`
  ctx.fillText(brand.name.toUpperCase(), cx, y)
  y += s(44)
  ctx.font = `700 ${s(26)}px ${MONO}`
  ctx.fillText(perfect ? '* PAID IN FULL *' : '* FINAL RECEIPT *', cx, y)

  y += s(150)
  ctx.font = `${s(130)}px ${MONO}`
  ctx.fillText(d.emoji, cx, y)
  y += s(70)

  rule(ctx, s, px, iw, y)
  y += s(56)
  ctx.textAlign = 'left'
  ctx.font = `400 ${s(28)}px ${MONO}`
  ctx.fillText(`NO. ${ticketNo(d.id)}`, px, y)
  ctx.textAlign = 'right'
  ctx.fillText(dateStr(d.createdAt), px + iw, y)
  y += s(40)
  rule(ctx, s, px, iw, y, true)

  y += s(72)
  ctx.textAlign = 'left'
  ctx.fillStyle = FAINT
  ctx.font = `700 ${s(26)}px ${MONO}`
  ctx.fillText('ITEM', px, y)
  y += s(54)
  ctx.fillStyle = INK
  ctx.font = `700 ${s(46)}px ${MONO}`
  const goalLines = wrapText(ctx, (d.goal || 'my run').toUpperCase(), iw).slice(0, 2)
  goalLines.forEach((ln) => {
    ctx.fillText(ln, px, y)
    y += s(54)
  })

  y += s(40)
  rule(ctx, s, px, iw, y, true)
  y += s(64)
  leader(ctx, s, px, iw, y, 'DAYS KEPT', `${d.daysCompleted}/${d.durationDays}`)
  y += s(40)
  rule(ctx, s, px, iw, y)
  y += s(64)
  leader(ctx, s, px, iw, y, perfect ? 'PAID OUT' : 'REFUND', `${fmtAmount(d.payout)} ${d.asset}`, true)
  y += s(40)
  rule(ctx, s, px, iw, y)

  y += s(80)
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `700 ${s(30)}px ${MONO}`
  ctx.fillText(perfect ? `*** BANKED ${milestone(d.durationDays).toUpperCase()} ***` : '*** THAT WAS MY RUN ***', cx, y)

  barcode(ctx, s, cx, bot - s(250), iw * 0.82, s(120), d.id)
  ctx.fillStyle = INK
  ctx.font = `700 ${s(34)}px ${MONO}`
  ctx.fillText('RUN IT BACK — TAP IN 👀', cx, bot - s(86))
  ctx.textAlign = 'left'
}

export const receipt: CardStyle = {
  id: 'receipt',
  name: 'Receipt',
  swatch: { bg: BG, fg: PAPER, accent: INK },
  render(ctx, data, size) {
    if (data.kind === 'pledge') drawPledge(ctx, data, size)
    else if (data.kind === 'results') drawResults(ctx, data, size)
  },
}
