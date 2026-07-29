// Style: "The Pledge" — the app's signature warm-editorial ticket, on canvas.
// Reads the brand layer (theme + copy) so it stays in lock-step with the app's CI and
// the in-app DOM ticket (src/product/PledgeTicket.tsx): same language — rubber-ink
// stamp, "No." ticket number, clean dashed perforation, signed/sealed footer.
// Other styles deliberately do NOT — they bring their own look.

import { theme, copy, milestone } from '../../brand/index.ts'
import { avatarColor, initials } from '../../product/store.ts'
import { drawAvatar, drawLines, fmtAmount, roundRectPath, wrapText } from '../draw.ts'
import type { CardStyle, DayMark, PledgeCardData, ProgressCardData, ResultsCardData, Size } from '../types.ts'

const C = theme.color
const DISPLAY = theme.font.displayFamily
const UI = theme.font.uiFamily

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Stable 4-digit ticket "No." from the challenge id (matches PledgeTicket.tsx). */
function ticketNo(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return `No. ${String((h % 9000) + 1000)}`
}

/** "JUN 29 ’26" */
function sealedDate(ms: number): string {
  const d = new Date(ms)
  return `${MON[d.getMonth()]} ${d.getDate()} ’${String(d.getFullYear()).slice(-2)}`
}

function whosInLine(names: string[]): string {
  if (names.length <= 1) return copy.join.whosInOne(names[0] ?? 'You')
  if (names.length === 2) return copy.join.whosInTwo(names[0], names[1])
  return copy.join.whosInMany(names[0], names[1], names.length - 2)
}

/** Shared frame: paper background, drop-shadowed card, inset ink rule, brand row + No. */
function frame(ctx: CanvasRenderingContext2D, size: Size, s: (n: number) => number, no: string) {
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
  // brand mark with the vermilion dot
  ctx.fillStyle = C.stake
  ctx.beginPath()
  ctx.arc(px + s(11), m + s(98), s(11), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.ink
  ctx.textAlign = 'left'
  ctx.font = `900 ${s(42)}px ${DISPLAY}`
  ctx.fillText(copy.cards.brand, px + s(36), m + s(110))
  // ticket number, right
  ctx.fillStyle = C.inkFaint
  ctx.font = `700 ${s(24)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.textAlign = 'right'
  ctx.fillText(no.toUpperCase(), px + pw, m + s(110))
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
  return { m, cw, ch, px, pw }
}

/** Rubber-ink stamp — matte, double rounded-rect border + condensed display word. */
function rubberStamp(
  ctx: CanvasRenderingContext2D,
  s: (n: number) => number,
  cx: number,
  cy: number,
  main: string,
  sub: string,
  color: string,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-11 * Math.PI) / 180)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  const w = s(250)
  const h = s(150)
  ctx.globalAlpha = 0.85
  roundRectPath(ctx, -w / 2, -h / 2, w, h, s(20))
  ctx.lineWidth = s(7)
  ctx.stroke()
  ctx.globalAlpha = 0.5
  roundRectPath(ctx, -w / 2 + s(11), -h / 2 + s(11), w - s(22), h - s(22), s(14))
  ctx.lineWidth = s(3)
  ctx.stroke()
  ctx.globalAlpha = 0.82
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.save()
  ctx.scale(0.9, 1) // condensed feel
  ctx.font = `900 ${s(66)}px ${DISPLAY}`
  ctx.fillText(main, 0, -s(12))
  ctx.restore()
  ctx.font = `800 ${s(24)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText(sub, 0, s(40))
  ctx.letterSpacing = '0px'
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** A clean dashed perforation rule (no notches — matches the in-app ticket). */
function dashedTear(ctx: CanvasRenderingContext2D, s: (n: number) => number, m: number, cw: number, y: number) {
  ctx.save()
  ctx.strokeStyle = C.line
  ctx.lineWidth = s(3)
  ctx.setLineDash([s(14), s(12)])
  ctx.beginPath()
  ctx.moveTo(m + s(44), y)
  ctx.lineTo(m + cw - s(44), y)
  ctx.stroke()
  ctx.restore()
}

/** Signed-by / sealed footer (matches the in-app ticket stub). */
function signedFoot(
  ctx: CanvasRenderingContext2D,
  s: (n: number) => number,
  px: number,
  rightX: number,
  fy: number,
  name: string,
  createdAt: number,
) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.inkFaint
  ctx.font = `700 ${s(24)}px ${UI}`
  ctx.letterSpacing = `${s(3)}px`
  ctx.fillText(copy.cards.ticketSignedBy.toUpperCase(), px, fy - s(38))
  ctx.letterSpacing = '0px'
  ctx.fillStyle = C.ink
  ctx.font = `italic 600 ${s(52)}px ${DISPLAY}`
  ctx.fillText(name, px, fy + s(10))

  ctx.textAlign = 'right'
  ctx.fillStyle = C.inkFaint
  ctx.font = `700 ${s(24)}px ${UI}`
  ctx.letterSpacing = `${s(3)}px`
  ctx.fillText(copy.cards.ticketSealed.toUpperCase(), rightX, fy - s(38))
  ctx.font = `700 ${s(28)}px ${UI}`
  ctx.fillText(sealedDate(createdAt).toUpperCase(), rightX, fy + s(4))
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
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
  const { m, cw, ch, px, pw } = frame(ctx, size, s, ticketNo(d.id))

  // emoji
  ctx.textAlign = 'left'
  ctx.font = `${s(150)}px ${UI}`
  ctx.fillText(d.emoji, px, m + s(320))

  // rubber-ink stamp (top-right whitespace)
  rubberStamp(ctx, s, m + cw - s(168), m + s(296), copy.cards.pledgeStamp, `· ${copy.cards.pledgeStampSub} ·`, C.stake)

  // kicker
  let y = m + s(430)
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

  // stake — green (money), matching the in-app ticket
  y += s(124)
  ctx.fillStyle = C.go
  ctx.font = `700 ${s(94)}px ${DISPLAY}`
  const stakeStr = `${d.stake} ${d.asset}`
  ctx.fillText(stakeStr, px, y)
  const sw = ctx.measureText(stakeStr).width
  ctx.fillStyle = C.inkSoft
  ctx.font = `600 ${s(38)}px ${UI}`
  ctx.fillText(`  ${copy.cards.pledgeOnLine}`, px + sw, y)

  // who's-in, grouped under the stake
  const whoY = y + s(96)
  const ax = avatarRow(ctx, s, d.whosIn, px, whoY)
  ctx.fillStyle = C.ink
  ctx.font = `700 ${s(34)}px ${UI}`
  ctx.textBaseline = 'middle'
  ctx.fillText(whosInLine(d.whosIn), ax, whoY)
  ctx.textBaseline = 'alphabetic'

  dashedTear(ctx, s, m, cw, m + ch - s(280))

  // baked-in CTA — the invite *is* the image
  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(44)}px ${UI}`
  ctx.fillText('Doors are open — tap in 👀', px, m + ch - s(176))

  signedFoot(ctx, s, px, m + cw - s(80), m + ch - s(92), d.creatorName, d.createdAt)
}

function drawResults(ctx: CanvasRenderingContext2D, d: ResultsCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const perfect = d.isPerfectFinisher
  const { m, cw, ch, px, pw } = frame(ctx, size, s, ticketNo(d.id))

  ctx.textAlign = 'left'
  ctx.font = `${s(150)}px ${UI}`
  ctx.fillText(d.emoji, px, m + s(320))

  // a green "BANKED" stamp for a flawless run — the parallel of the pledge stamp
  if (perfect) {
    rubberStamp(ctx, s, m + cw - s(168), m + s(296), 'BANKED', '· IN FULL ·', C.go)
  }

  let y = m + s(430)
  ctx.fillStyle = perfect ? C.go : C.stake
  ctx.font = `800 ${s(34)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText(perfect ? `BANKED ${milestone(d.durationDays).toUpperCase()} ✅` : 'THAT WAS MY RUN', px, y)
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
  ctx.fillText(perfect ? copy.results.banked(d.asset) : copy.results.back(d.asset), px, y + s(58))

  // streak grid — each miss lands on its own day (✕), then the count beneath it
  const gridBottom = drawStreak(ctx, s, px, pw, y + s(120), d.days)
  ctx.fillStyle = C.inkSoft
  ctx.font = `700 ${s(40)}px ${UI}`
  ctx.fillText(`${d.daysCompleted}/${d.durationDays} days kept`, px, gridBottom + s(64))

  dashedTear(ctx, s, m, cw, m + ch - s(280))

  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(44)}px ${UI}`
  ctx.fillText('Run it back with me — tap in 👀', px, m + ch - s(176))

  signedFoot(ctx, s, px, m + cw - s(80), m + ch - s(92), d.creatorName, d.createdAt)
}

/** Row of day-cells painted from the ACTUAL per-day pattern — so a missed day lands on its
 *  own cell (✕), not "first N filled". Mirrors the in-app streak board (.cell states):
 *  done = green ✓, missed = red ✕, today = ink-outlined number, todo = faint-outlined number. */
function drawStreak(
  ctx: CanvasRenderingContext2D,
  s: (n: number) => number,
  px: number,
  pw: number,
  y: number,
  days: DayMark[],
) {
  const total = days.length
  const gap = s(12)
  const cell = Math.min(s(74), (pw - (total - 1) * gap) / total)
  const glyph = cell > s(40)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const midX = (i: number) => px + i * (cell + gap) + cell / 2
  const midY = y + cell / 2 + s(2)
  days.forEach((mark, i) => {
    const cx = px + i * (cell + gap)
    roundRectPath(ctx, cx, y, cell, cell, s(12))
    if (mark === 'done') {
      ctx.fillStyle = C.go
      ctx.fill()
      if (glyph) {
        ctx.fillStyle = '#fff'
        ctx.font = `800 ${cell * 0.5}px ${UI}`
        ctx.fillText('✓', midX(i), midY)
      }
    } else if (mark === 'missed') {
      ctx.fillStyle = C.stakeTint
      ctx.fill()
      ctx.strokeStyle = C.stake
      ctx.lineWidth = s(3)
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      if (glyph) {
        ctx.fillStyle = C.stake
        ctx.font = `800 ${cell * 0.5}px ${UI}`
        ctx.fillText('✕', midX(i), midY)
      }
    } else {
      // today (emphasised) / todo (faint) — outlined with the day number
      const today = mark === 'today'
      ctx.strokeStyle = today ? C.lineStrong : C.line
      ctx.lineWidth = today ? s(4) : s(3)
      ctx.stroke()
      if (glyph) {
        ctx.fillStyle = today ? C.ink : C.inkFaint
        ctx.font = `700 ${cell * 0.42}px ${UI}`
        ctx.fillText(String(i + 1), midX(i), midY)
      }
    }
  })
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  return y + cell
}

function drawProgress(ctx: CanvasRenderingContext2D, d: ProgressCardData, size: Size) {
  const u = size.w / 1080
  const s = (n: number) => n * u
  const { m, cw, ch, px, pw } = frame(ctx, size, s, ticketNo(d.id))

  ctx.textAlign = 'left'
  ctx.font = `${s(150)}px ${UI}`
  ctx.fillText(d.emoji, px, m + s(320))

  // day stamp (top-right)
  rubberStamp(ctx, s, m + cw - s(168), m + s(296), `DAY ${d.currentDay}`, `· OF ${d.durationDays} ·`, C.stake)

  let y = m + s(430)
  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(34)}px ${UI}`
  ctx.letterSpacing = `${s(4)}px`
  ctx.fillText('STILL IN IT', px, y)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = C.ink
  ctx.font = `600 ${s(104)}px ${DISPLAY}`
  const goalLines = wrapText(ctx, d.goal, pw).slice(0, 2)
  y = drawLines(ctx, goalLines, px, y + s(110), s(108))

  // streak row
  y += s(72)
  const cellBottom = drawStreak(ctx, s, px, pw, y, d.days)

  // days kept
  y = cellBottom + s(96)
  ctx.fillStyle = C.go
  ctx.font = `700 ${s(110)}px ${DISPLAY}`
  const kept = `${d.daysKept}/${d.durationDays}`
  ctx.fillText(kept, px, y)
  const kw = ctx.measureText(kept).width
  ctx.fillStyle = C.inkSoft
  ctx.font = `600 ${s(40)}px ${UI}`
  ctx.fillText('  days kept', px + kw, y)

  dashedTear(ctx, s, m, cw, m + ch - s(280))

  ctx.fillStyle = C.stake
  ctx.font = `800 ${s(44)}px ${UI}`
  ctx.fillText('Keep me honest — tap in 👀', px, m + ch - s(176))

  signedFoot(ctx, s, px, m + cw - s(80), m + ch - s(92), d.creatorName, d.createdAt)
}

export const pledgeTicket: CardStyle = {
  id: 'ticket',
  name: 'The Pledge',
  swatch: { bg: C.paperCard, fg: C.ink, accent: C.stake },
  render(ctx, data, size) {
    if (data.kind === 'pledge') drawPledge(ctx, data, size)
    else if (data.kind === 'results') drawResults(ctx, data, size)
    else drawProgress(ctx, data, size)
  },
}
