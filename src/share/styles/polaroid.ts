// Style: "Polaroid" — a snapshot taped to a wall, with a handwritten caption. Casual and
// personal, native to an Instagram feed. Brings its OWN look (warm wall + white frame +
// a faux duotone "photo" with the goal emoji as the subject). The big emoji keeps it
// legible at thumbnail size.

import { roundRectPath, wrapText, fmtAmount } from '../draw.ts'
import type { CardStyle, PledgeCardData, ResultsCardData, Size } from '../types.ts'

const DISPLAY = 'Fraunces'
const UI = 'Hanken Grotesk'
const CARD = '#fdfdfb'
const INK = '#2a2018'
const SOFT = '#8d8270'

function wall(ctx: CanvasRenderingContext2D, size: Size) {
  const g = ctx.createLinearGradient(0, 0, 0, size.h)
  g.addColorStop(0, '#e7dfd0')
  g.addColorStop(1, '#cbbca3')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size.w, size.h)
}

function tape(ctx: CanvasRenderingContext2D, s: (n: number) => number, x: number, y: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  const w = s(150)
  const h = s(52)
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = 'rgba(28,20,12,0.06)'
  ctx.lineWidth = s(2)
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.restore()
}

/** The polaroid card (rotated), with a duotone photo + emoji. Caption drawn by caller in
 *  the same rotated frame; returns the local photo-bottom y so the caller can place text. */
function polaroid(
  ctx: CanvasRenderingContext2D,
  size: Size,
  s: (n: number) => number,
  emoji: string,
  photoTop: string,
  photoBot: string,
) {
  const cardW = s(780)
  const bord = s(46)
  const photo = cardW - 2 * bord
  const bBot = s(300)
  const cardH = bord + photo + bBot

  ctx.translate(size.w / 2, size.h / 2)
  ctx.rotate((-3 * Math.PI) / 180)
  const x = -cardW / 2
  const y = -cardH / 2

  ctx.save()
  ctx.shadowColor = 'rgba(28,20,12,0.34)'
  ctx.shadowBlur = s(60)
  ctx.shadowOffsetY = s(30)
  roundRectPath(ctx, x, y, cardW, cardH, s(8))
  ctx.fillStyle = CARD
  ctx.fill()
  ctx.restore()

  // photo
  const phx = x + bord
  const phy = y + bord
  const pg = ctx.createLinearGradient(phx, phy, phx, phy + photo)
  pg.addColorStop(0, photoTop)
  pg.addColorStop(1, photoBot)
  roundRectPath(ctx, phx, phy, photo, photo, s(3))
  ctx.fillStyle = pg
  ctx.fill()
  // soft vignette
  const vg = ctx.createRadialGradient(phx + photo / 2, phy + photo * 0.42, s(40), phx + photo / 2, phy + photo / 2, photo * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.16)')
  ctx.fillStyle = vg
  ctx.fill()
  // emoji subject
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${s(300)}px ${UI}`
  ctx.fillText(emoji, phx + photo / 2, phy + photo / 2 + s(10))
  ctx.textBaseline = 'alphabetic'

  // tape at the top corners
  tape(ctx, s, x + s(70), y + s(8), -0.4)
  tape(ctx, s, x + cardW - s(70), y + s(8), 0.4)

  return { capY: phy + photo, capW: photo, capLeft: phx }
}

function drawPledge(ctx: CanvasRenderingContext2D, d: PledgeCardData, size: Size) {
  const s = (n: number) => (n * size.w) / 1080
  wall(ctx, size)
  ctx.save()
  const { capY } = polaroid(ctx, size, s, d.emoji, '#ffd7a0', '#ff9d7c')

  let y = capY + s(96)
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `italic 600 ${s(58)}px ${DISPLAY}`
  const lines = wrapText(ctx, d.goal || 'doing the thing', s(640)).slice(0, 1)
  ctx.fillText(lines[0], 0, y)

  y += s(58)
  ctx.fillStyle = SOFT
  ctx.font = `600 ${s(30)}px ${UI}`
  ctx.fillText(`${d.stake} ${d.asset} on the line · ${d.durationDays} days`, 0, y)

  y += s(62)
  ctx.fillStyle = INK
  ctx.font = `italic 600 ${s(38)}px ${DISPLAY}`
  ctx.fillText(`— ${d.creatorName} · watch me 👀`, 0, y)

  ctx.restore()
}

function drawResults(ctx: CanvasRenderingContext2D, d: ResultsCardData, size: Size) {
  const s = (n: number) => (n * size.w) / 1080
  const perfect = d.isPerfectFinisher
  wall(ctx, size)
  ctx.save()
  const top = perfect ? '#bfe9c6' : '#ffd7a0'
  const bottom = perfect ? '#74c79a' : '#ff9d7c'
  const { capY } = polaroid(ctx, size, s, d.emoji, top, bottom)

  let y = capY + s(96)
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `italic 600 ${s(58)}px ${DISPLAY}`
  ctx.fillText(perfect ? 'Perfect week ✅' : (wrapText(ctx, d.goal || 'my week', s(640))[0] ?? 'my week'), 0, y)

  y += s(58)
  ctx.fillStyle = SOFT
  ctx.font = `600 ${s(30)}px ${UI}`
  ctx.fillText(`${fmtAmount(d.payout)} ${d.asset} back · ${d.daysCompleted}/${d.durationDays} days`, 0, y)

  y += s(62)
  ctx.fillStyle = INK
  ctx.font = `italic 600 ${s(38)}px ${DISPLAY}`
  ctx.fillText(`— ${d.creatorName} · run it back 👀`, 0, y)

  ctx.restore()
}

export const polaroid_: CardStyle = {
  id: 'polaroid',
  name: 'Polaroid',
  swatch: { bg: '#d7c9b0', fg: INK, accent: '#ff9d7c' },
  render(ctx, data, size) {
    if (data.kind === 'pledge') drawPledge(ctx, data, size)
    else if (data.kind === 'results') drawResults(ctx, data, size)
  },
}
