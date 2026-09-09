import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { RATIO, SQ3, roundedHex } from '../brand/hex.ts'
import { copy } from '../brand/index.ts'
import { type Challenge, currentDay, effectiveStatus, type DayMark } from './model.ts'
import { TEMPLATES, type Template } from './templates.ts'
import { cardArt, journeyArt } from './illus.ts'

// The shared primitives, ported one-for-one from the finished onboarding-v2 artboards
// (design source now in the studio brand repo). Faithful, not reskinned. Class names match
// reshape.css (scoped under `.rs`). fill = time · solid = you.

// ---- icons (inline; stroke = currentColor) ----------------------------------
const P = (d: string) => <path d={d} key={d} />
export const Icon = {
  arrow: (
    <svg className="ico" viewBox="0 0 24 24">
      {P('M5 12h14')}
      {P('M13 6l6 6-6 6')}
    </svg>
  ),
  check: (
    <svg className="ico" viewBox="0 0 24 24">
      {P('M5 13l4 4L19 7')}
    </svg>
  ),
  share: (
    <svg className="ico" viewBox="0 0 24 24">
      {P('M12 3v13')}
      {P('M8 7l4-4 4 4')}
      {P('M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7')}
    </svg>
  ),
  trend: (
    <svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--cream)' }}>
      {P('M7 17L17 7')}
      {P('M8 7h9v9')}
    </svg>
  ),
}

// ---- shell frame: scroll canvas · pinned foot · pinned sphere ---------------
export function Frame({
  children,
  foot,
  sphere,
  center,
}: {
  children: ReactNode
  foot?: ReactNode
  sphere?: ReactNode
  center?: boolean
}) {
  return (
    <>
      <div className={'rs-canvas' + (center ? ' center' : '')}>
        <div className="rs-screen">{children}</div>
      </div>
      {sphere}
      {foot && <div className="rs-foot">{foot}</div>}
    </>
  )
}

export function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <button className="wm" onClick={onClick} aria-label={copy.a11y.home}>
      Stakes<span className="fs">.</span>
    </button>
  )
}

// The header row: the wordmark, and (in a challenge) the persistent challenge indicator so you
// always know which one you're in — handoff 2026-09-04, point 3.
export function TopBar({ onWordmark, chip }: { onWordmark?: () => void; chip?: ReactNode }) {
  return (
    <div className="rs-top">
      <Wordmark onClick={onWordmark} />
      {chip}
    </div>
  )
}

// The challenge indicator: name + a day-hex glyph. Name-only during the taste (durationDays not
// chosen yet); name + "Day n of N" once it's a running stake. Tappable back to the picker ONLY
// pre-commit — choosing a different one there silently replaces the taste (the escape, point 2).
// Never tappable once money is on it (forward-only). One green dot, never a bead: the live sphere
// stays the single vermilion bead on the surface.
export function ChallengeChip({ challenge, onPicker }: { challenge: Challenge; onPicker?: () => void }) {
  const label = TEMPLATES.find((t) => t.id === challenge.templateId)?.label ?? challenge.goal
  const running = effectiveStatus(challenge) === 'official'
  const day = running ? Math.min(currentDay(challenge) + 1, challenge.durationDays) : 0
  const tappable = effectiveStatus(challenge) === 'window' && !!onPicker
  const inner = (
    <>
      <span className="cc-dot" />
      <span className="cc-name">{label}</span>
      {running && <span className="cc-day">{copy.rs.chip.dayOfN(day, challenge.durationDays)}</span>}
    </>
  )
  return tappable ? (
    <button className="challengechip" onClick={onPicker} aria-label={copy.a11y.changeChallenge}>
      {inner}
    </button>
  ) : (
    <span className="challengechip">{inner}</span>
  )
}

// The in-journey day banner: the challenge's dot-free scene carrying its name + "Day n of N".
// Dot-free so the pinned live sphere stays the one bead. Behind the ILLUS flag (prototype).
export function DayBanner({ challenge }: { challenge: Challenge }) {
  const label = TEMPLATES.find((t) => t.id === challenge.templateId)?.label ?? challenge.goal
  const day = Math.min(currentDay(challenge) + 1, challenge.durationDays)
  return (
    <div className="daybanner">
      <img className="db-art" src={journeyArt(challenge.templateId)} alt="" draggable={false} loading="lazy" decoding="async" />
      <div className="db-text">
        <div className="db-name">{label}</div>
        <div className="db-day">{copy.rs.chip.dayOfN(day, challenge.durationDays)}</div>
      </div>
    </div>
  )
}

export function Cta({
  label,
  variant = 'green',
  icon,
  onClick,
  disabled,
}: {
  label: ReactNode
  variant?: 'green' | 'blue'
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button className={`cta cta--${variant}`} onClick={onClick} disabled={disabled}>
      {label}
      {icon}
    </button>
  )
}

// ---- the sphere -------------------------------------------------------------
export function Sphere({ onClick, raised, motion = 'calm', faded }: { onClick?: () => void; raised?: boolean; motion?: 'calm' | 'lively'; faded?: boolean }) {
  // faded = present but inert: nothing to say, nothing to tap (the Archive dot). The same 25%
  // treatment the dot wears on the sealed day (06) and share card (07) — a span, not a button,
  // so it can't be focused or clicked (design "Rules the build needs", 2026-09-08).
  if (faded) {
    return (
      <span className={'sphereFab faded' + (raised ? ' raised' : '')} aria-hidden="true">
        <span className="sh" />
        <span className="ball">
          <span className="spec" />
        </span>
      </span>
    )
  }
  return (
    <button
      className={'sphereFab' + (raised ? ' raised' : '') + (motion === 'lively' ? ' lively' : '')}
      onClick={onClick}
      aria-label={copy.a11y.openSphere}
    >
      <span className="sh" />
      <span className="ball">
        <span className="spec" />
      </span>
    </button>
  )
}

// ---- the dot's speech (Journey 04b): a dot-anchored speech bubble, tap-only. The dot rides
// bottom-right; a tap opens the bubble ABOVE it with the tail pointing at the dot (the 18/18/6/18
// corner), a tap anywhere else closes it, and on the day/missed screens a re-tap re-rolls the line.
// No scrim, no dim — the day stays fully visible behind it (a pause, not a new place). ----
export function DotSpeak({
  open,
  onTap,
  onClose,
  motion = 'lively',
  meta,
  line,
  source,
  faded,
  raised,
}: {
  open: boolean
  onTap: () => void
  onClose: () => void
  motion?: 'calm' | 'lively'
  meta?: string
  line?: ReactNode
  source?: string | null
  faded?: boolean
  raised?: boolean // sit higher, to clear a two-button foot
}) {
  const dock = 'dotdock' + (raised ? ' raised' : '')
  // On the sealed day (06) and the share card (07) the dot has nothing to add — it fades to 25%
  // and goes inert rather than vacating its corner (design "Rules the build needs", 2026-09-08).
  if (faded) {
    return (
      <div className={dock}>
        <span className="dot-fab faded" aria-hidden="true">
          <span className="sh" />
          <span className="ball">
            <span className="spec" />
          </span>
        </span>
      </div>
    )
  }
  return (
    <>
      {open && <button className="dot-scrim" aria-label={copy.a11y.close} onClick={onClose} />}
      <div className={dock}>
        {open && line != null && (
          <div className="dotbubble" role="status">
            {meta && <p className="db-meta">{meta}</p>}
            <p className="db-line">{line}</p>
            {source && <p className="db-src">— {source}</p>}
          </div>
        )}
        {/* key on `open` so the dot RESTARTS its bob the instant the bubble opens: both then share
            one start, and the bubble trails by --lag every time (not a random phase from tap timing)
            — the two move WITH each other, never against. */}
        <button
          key={open ? 'talk' : 'idle'}
          className={'dot-fab' + (motion === 'lively' ? ' lively' : '')}
          onClick={onTap}
          aria-label={copy.a11y.openSphere}
        >
          <span className="sh" />
          <span className="ball">
            <span className="spec" />
          </span>
        </button>
      </div>
    </>
  )
}

// ---- the frosted pop-over (hint = lively · pick = calm) ---------------------
export function PopOver({
  variant,
  children,
  onClose,
}: {
  variant: 'hint' | 'pick'
  children: ReactNode
  onClose: () => void
}) {
  return (
    <>
      <button className="scrim" aria-label={copy.a11y.close} onClick={onClose} />
      <div className={'pop ' + variant}>{children}</div>
    </>
  )
}

// ---- the mark in the UI: the locked Stakes Hex (src/brand/hex.ts · RATIO 0.4) ----
// A day is the softened hex — never a bead, never a plain circle (design-sweep §1a). Four states:
//   future → outline only (--line)          today  → fill rises bottom-up, outline --go
//   kept/sealed → solid --go + a cream check  missed/faded → flat --grey
// fill = time (rising) · the cream check = you (sealed). Live SVG, no riso — so the check is
// opaque on NORMAL blend (a multiply blend erases cream over green); its p1/p2/p3 geometry is the
// studio engine's kept(). The today rise is a discrete green-dot halftone on the big hero (canon
// §8) and a solid fill in the small in-UI hexes (≤~40px), where a halftone just muddies.
export type HexState = 'today' | 'kept' | 'future' | 'missed' | 'sealed' | 'faded'
export function Hex({
  size,
  state = 'future',
  fill = 0,
  fillColor,
  children,
}: {
  size: number
  state?: HexState
  fill?: number
  fillColor?: string
  children?: ReactNode
}) {
  const uid = useId().replace(/:/g, '')
  const R = size / 2

  // below the floor a rounded hex reads as mud — draw a plain dot instead (§1a)
  if (size < 18) {
    const solid = state === 'kept' || state === 'sealed' ? 'var(--go)' : state === 'missed' || state === 'faded' ? 'var(--grey)' : 'transparent'
    return (
      <span className="hex" style={{ display: 'inline-block', width: size, height: size, lineHeight: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block' }}>
          <circle cx={R} cy={R} r={R - 1} fill={solid} stroke={state === 'future' ? 'var(--line-strong)' : 'none'} strokeWidth={state === 'future' ? 1.5 : 0} />
        </svg>
      </span>
    )
  }

  const H = SQ3 * R
  const cx = R
  const cy = H / 2
  const shell = roundedHex(cx, cy, R, RATIO * R)
  const kept = state === 'kept' || state === 'sealed'
  const solidShell = kept ? 'var(--go)' : state === 'missed' || state === 'faded' ? 'var(--grey)' : null
  const isToday = state === 'today'
  const rise = fillColor ?? 'var(--go)'
  const halftone = isToday && size >= 40 && !fillColor // discrete green-dot halftone on the hero; solid below (canon §8)
  const cell = Math.max(4.5, R * 0.13)
  // the cream check (§1a) — the engine's kept() geometry, stroked opaque on normal blend
  const p1 = [cx - 0.3 * R, cy + 0.04 * R]
  const p2 = [cx - 0.07 * R, cy + 0.25 * R]
  const p3 = [cx + 0.34 * R, cy - 0.24 * R]
  const check = `M${p1[0].toFixed(2)} ${p1[1].toFixed(2)}L${p2[0].toFixed(2)} ${p2[1].toFixed(2)}L${p3[0].toFixed(2)} ${p3[1].toFixed(2)}`
  const outline = Math.max(1.5, R * 0.05)

  return (
    <span className="hex" style={{ display: 'inline-block', position: 'relative', width: size, height: H, lineHeight: 0 }}>
      <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <clipPath id={'hc' + uid}>
            <path d={shell} />
          </clipPath>
          {halftone && (
            <pattern id={'ht' + uid} width={cell} height={cell} patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
              <circle cx={cell / 2} cy={cell / 2} r={cell * 0.42} fill="var(--go)" />
            </pattern>
          )}
        </defs>
        {/* the solid states fill the shell; today/future leave the paper showing */}
        {solidShell && <path d={shell} fill={solidShell} />}
        {/* today: the fill rises bottom-up (halftone on the hero, solid in the small hexes) */}
        {isToday && fill > 0 && (
          <rect x={0} y={H * (1 - fill)} width={size} height={H * fill} fill={halftone ? `url(#ht${uid})` : rise} clipPath={`url(#hc${uid})`} />
        )}
        {/* the outline: --go for today, --line for future; the solid states carry none */}
        {(isToday || state === 'future') && <path d={shell} fill="none" stroke={state === 'future' ? 'var(--line)' : 'var(--go)'} strokeWidth={outline} />}
        {/* kept / sealed: the cream check, opaque, normal blend */}
        {kept && <path d={check} fill="none" stroke="var(--cream)" strokeWidth={R * 0.15} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {children != null && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</span>}
    </span>
  )
}

// ---- the hero — the same day-hex at ~150px (§1b): today halftone · sealed green + cream check ·
// missed / faded flat grey. No emoji, no placeholder two-tone; the check comes from Hex itself. ----
// A just-started day/taste reads as EMPTY at fill ≈ 0, which looks unfinished — so a filling hero
// never drops below a small visible sliver (Hendrik, 2026-09-08). 0.08 is the floor because the
// hero's dot-halftone cell is ~18px: below ~7.5% the fill shows less than one row of dots and reads
// as accidental; 0.08 paints one clean row. Real elapsed time takes over the moment it passes this.
const HERO_MIN_FILL = 0.08
export function HeroDot({
  fill = 0,
  state = 'filling',
  size = 140,
}: {
  fill?: number
  state?: 'filling' | 'sealed' | 'missed' | 'faded'
  size?: number
}) {
  const w = Math.round(size / 0.866) // a flat-top hex is 0.866× as tall as wide — widen to hold the presence
  const hexState: HexState = state === 'filling' ? 'today' : state
  return (
    <span className={'heroHex' + (state === 'sealed' ? ' sealed' : state === 'faded' ? ' faded' : '')}>
      <Hex size={w} state={hexState} fill={state === 'filling' ? Math.max(HERO_MIN_FILL, fill) : 0} />
    </span>
  )
}

// ---- the week frame (18px hexes, gap 9 — §11.3) -----------------------------
const WHEX: Record<DayMark, HexState> = { done: 'kept', today: 'today', missed: 'missed', todo: 'future' }
export function WeekFrame({ marks, label }: { marks: DayMark[]; label?: string }) {
  return (
    <div className="weekframe">
      <div className="weekrow">
        {marks.map((m, i) => (
          <Hex key={i} size={18} state={WHEX[m]} fill={m === 'today' ? 0.5 : 0} />
        ))}
      </div>
      {label && <span className="weeklabel">{label}</span>}
    </div>
  )
}

// ---- the growing chain (Journey sweep): a left-aligned row of day-hexes, behind + today,
// never a future socket. Same 18px hex as the week frame, but no frame/label and left-set. ----
export function Chain({ marks, size = 18, fill = 0.5 }: { marks: DayMark[]; size?: number; fill?: number }) {
  return (
    <div className="chainrow">
      {marks.map((m, i) => (
        <Hex key={i} size={size} state={WHEX[m]} fill={m === 'today' ? fill : 0} />
      ))}
    </div>
  )
}

// ---- the day's chain + its meta (Journey 04/08/12): behind + today, CAPPED AT 10 beads so a
// 14- or 30-day run occupies the same strip as a 7-day one (design "Rules the build needs"). Older
// kept days collapse into a "+N earlier" chip; the banked count keeps its own line, never pushed
// off-frame. Short runs read side-by-side; a capped run stacks the strip over its meta. ----
const CHAIN_CAP = 10
export function DayChain({ marks, keptCount, safe, todayFill = 0.5 }: { marks: DayMark[]; keptCount: number; safe: number; todayFill?: number }) {
  const collapsed = Math.max(0, marks.length - CHAIN_CAP)
  const visible = collapsed > 0 ? marks.slice(-CHAIN_CAP) : marks
  if (collapsed > 0) {
    return (
      <div className="daychain daychain--long">
        <Chain marks={visible} size={24} fill={todayFill} />
        <div className="cn-meta">
          <span className="cn-earlier">{copy.rs.chain.earlier(collapsed)}</span>
          <span className="cn-count">{copy.rs.chain.bankedDays(keptCount)}</span>
          <span className="cn-safe">{copy.rs.chain.safe(safe)}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="daychain">
      <Chain marks={visible} size={22} fill={todayFill} />
      <div className="cn-txt">
        <p className="cn-lead">{copy.rs.chain.bankedDays(keptCount)}</p>
        <p className="cn-safe">{copy.rs.chain.safeNote(safe)}</p>
      </div>
    </div>
  )
}

// ---- the stake steppers -----------------------------------------------------
export function Stepper({
  value,
  unit,
  onDec,
  onInc,
  canDec = true,
  canInc = true,
}: {
  value: number | string
  unit: string
  onDec: () => void
  onInc: () => void
  canDec?: boolean
  canInc?: boolean
}) {
  return (
    <div className="stepper">
      <button className="pm" onClick={onDec} disabled={!canDec} aria-label={`less ${unit}`}>
        −
      </button>
      <span className="amt">
        {value} <small>{unit}</small>
      </span>
      <button className="pm" onClick={onInc} disabled={!canInc} aria-label={`more ${unit}`}>
        +
      </button>
    </div>
  )
}

// ---- the official ticket (Journey 03): the goal + the OFFICIAL stamp, the amount held stated
// once as consent (mono), and the backdate note. Identity is the name only (no emoji, §1f). ----
export function ContractCard({ goalLabel, total, perDay }: { goalLabel: string; total: number; perDay: number }) {
  return (
    <div className="contract">
      <div className="ct-top">
        <div className="cg">{goalLabel}</div>
        <span className="stamp-official">{copy.rs.official.stamp}</span>
      </div>
      <p className="csn">{copy.rs.official.ticketTerms(total, perDay)}</p>
      <p className="ct-note">
        {copy.rs.official.backdateLead}
        <b>{copy.rs.official.backdateBold}</b>
      </p>
    </div>
  )
}

// ---- the shareable trophy card + the Nimiq on-chain proof -------------------
// The in-app preview carries the challenge's dot-free One Light scene (§3) — the live sphere is
// the surface's one bead, so no second dot and no separate beaded hex. (An exported PNG, a
// standalone surface, would use the --card art whose printed dot is then its own one bead.)
export function ShareCard({ templateId, seq, headline, stamp = copy.rs.shareCard.stampRecord }: { templateId: string; seq: number; headline: ReactNode; stamp?: string }) {
  return (
    <div className="sharecard">
      <div className="sc-top">
        <span className="wm2">
          Stakes<span className="fs">.</span>
        </span>
        <span className="sc-no">{copy.rs.shareCard.no(String(seq).padStart(3, '0'))}</span>
      </div>
      <div className="sc-art">
        <img src={journeyArt(templateId)} alt="" draggable={false} loading="lazy" decoding="async" />
      </div>
      <div className="sc-h">{headline}</div>
      <span className="stamp-record">{stamp}</span>
      {/* the traveling sign-off — the name + the hook (rs.share.tagline) */}
      <div className="sc-cta">{copy.rs.share.tagline}</div>
    </div>
  )
}

export function NimiqLink({ href }: { href?: string }) {
  return (
    <a className="nimiqlink" href={href} target="_blank" rel="noreferrer">
      {copy.rs.proof.pre}
      <span className="lock">
        <svg className="hex" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <radialGradient id="rs-nqg" cx="100%" cy="100%" r="141%">
              <stop offset="0" stopColor="var(--nimiq-gold-a)" />
              <stop offset="1" stopColor="var(--nimiq-gold-b)" />
            </radialGradient>
          </defs>
          <path d="M23 12L17.5 21.5H6.5L1 12L6.5 2.5H17.5L23 12Z" fill="url(#rs-nqg)" />
        </svg>
        <span className="nq">{copy.rs.proof.brand}</span>
      </span>
      {copy.rs.proof.post}
      <svg className="ext" viewBox="0 0 24 24">
        {P('M14 4h6v6')}
        {P('M20 4l-9 9')}
        {P('M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4')}
      </svg>
    </a>
  )
}

// ---- the on-chain receipt row (Journey 06/07): the Nimiq gold hex + a line + the open-out
// arrow. A tappable card row to the explorer when there's a real tx; a plain note in mock. ----
export function StampedRow({ label, href }: { label: string; href?: string }) {
  const uid = useId().replace(/:/g, '')
  const inner = (
    <>
      <span className="sr-lbl">
        <svg className="sr-hex" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <radialGradient id={'sg' + uid} cx="100%" cy="100%" r="141%">
              <stop offset="0" stopColor="var(--nimiq-gold-a)" />
              <stop offset="1" stopColor="var(--nimiq-gold-b)" />
            </radialGradient>
          </defs>
          <path d="M23 12L17.5 21.5H6.5L1 12L6.5 2.5H17.5L23 12Z" fill={`url(#sg${uid})`} />
        </svg>
        {label}
      </span>
      <svg className="sr-ext" viewBox="0 0 24 24" aria-hidden="true">
        {P('M14 4h6v6')}
        {P('M20 4l-9 9')}
        {P('M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4')}
      </svg>
    </>
  )
  return href ? (
    <a className="stampedrow" href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <div className="stampedrow" role="note">
      {inner}
    </div>
  )
}

// ---- the money block + the honest ledger (the payoff) ----------------------
export function Money({
  variant,
  label,
  amount,
  unit = 'NIM',
  gain,
  note,
  action,
}: {
  variant: 'win' | 'neutral' | 'quiet'
  label: string
  amount: number
  unit?: string
  gain?: string
  note?: string
  action?: ReactNode
}) {
  return (
    <div className={`money money--${variant}`}>
      {action && <div className="money-act">{action}</div>}
      <div className="lbl">{label}</div>
      <div className="big">
        {amount} <small>{unit}</small>
      </div>
      {gain && (
        <span className="gain">
          {Icon.trend}
          {gain}
        </span>
      )}
      {note && <div className="note">{note}</div>}
    </div>
  )
}

export interface LedgerRow {
  k: string
  v: string
  cls?: 'plus' | 'burn' | 'tot'
}
export function Ledger({ rows, tone }: { rows: LedgerRow[]; tone?: 'win' | 'neutral' }) {
  return (
    <div className={'brk' + (tone === 'neutral' ? ' neutral' : '')}>
      {rows.map((r, i) => (
        <div key={i} className={'brkrow' + (r.cls === 'tot' ? ' tot' : '') + (r.cls === 'burn' ? ' burn' : '')}>
          <span className="k">{r.k}</span>
          <span className={'v' + (r.cls === 'plus' ? ' plus' : '')}>{r.v}</span>
        </div>
      ))}
    </div>
  )
}

// ---- the perfect-week ring --------------------------------------------------
const RING: [number, number][] = [
  [0, -88],
  [69, -55],
  [84, 27],
  [38, 80],
  [-38, 80],
  [-84, 27],
  [-69, -55],
]
export function PerfectRing() {
  return (
    <div className="ring">
      <span className="mid">7</span>
      {RING.map(([x, y], i) => (
        <span key={i} className="rwd" style={{ transform: `translate(${x}px,${y}px)` }}>
          <Hex size={26} state="kept" />
        </span>
      ))}
    </div>
  )
}

// ---- the cold-open snap carousel: browse the nine, pick with the one button ----
// A native CSS scroll-snap track — no gesture library (design-sweep §0, replacing the retired
// Motion card-stack). `scroll-snap-type:x mandatory` + each card `scroll-snap-align:center` +
// `scroll-snap-stop:always` gives one card per swipe, locked to centre. The centred card (nearest
// the track's midpoint) drives the foot CTA; tapping an off-centre card scrolls it to centre.
// Swipe = browse only, never a start. No pagination chrome — the peek + a recurring nudge teach it.
export function Carousel({
  templates,
  startedThisWeek,
  onIndexChange,
}: {
  templates: Template[]
  startedThisWeek: Record<string, number>
  onIndexChange?: (t: Template) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  // keep the callback current without re-arming the scroll listener each render
  const report = useRef(onIndexChange)
  report.current = onIndexChange

  // the centred card = the one whose middle is nearest the track's midpoint (rAF-throttled)
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0
    const measure = () => {
      raf = 0
      const mid = track.scrollLeft + track.clientWidth / 2
      let best = 0
      let bestD = Infinity
      Array.from(track.children).forEach((node, i) => {
        const el = node as HTMLElement
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid)
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      setActive(best)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // tell the foot CTA which card it commits
  useEffect(() => {
    report.current?.(templates[active])
  }, [active, templates])

  // the recurring nudge: eases toward the next card and springs back — on open, then every 10s
  // while idle. The first real swipe (a pointerdown on the track) retires it for good.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let busy = false
    let holding = false
    let interval = 0
    let raf = 0
    const tween = (from: number, to: number, ms: number, done?: () => void) => {
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms)
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2 // easeInOutQuad
        track.scrollLeft = from + (to - from) * e
        if (p < 1) raf = requestAnimationFrame(step)
        else done?.()
      }
      raf = requestAnimationFrame(step)
    }
    const nudge = () => {
      if (busy || holding) return // never yank an active swipe
      busy = true
      const snap = track.style.scrollSnapType
      track.style.scrollSnapType = 'none' // don't let snap fight the tween
      const base = track.scrollLeft
      tween(base, base + 42, 460, () =>
        tween(base + 42, base, 520, () => {
          track.style.scrollSnapType = snap || 'x mandatory'
          busy = false
        }),
      )
    }
    const retire = () => {
      holding = true
      if (interval) {
        window.clearInterval(interval)
        interval = 0
      }
    }
    const release = () => {
      holding = false
    }
    track.addEventListener('pointerdown', retire)
    window.addEventListener('pointerup', release)
    const open = window.setTimeout(nudge, 700)
    interval = window.setInterval(nudge, 10_000)
    return () => {
      window.clearTimeout(open)
      if (interval) window.clearInterval(interval)
      if (raf) cancelAnimationFrame(raf)
      track.removeEventListener('pointerdown', retire)
      window.removeEventListener('pointerup', release)
      track.style.scrollSnapType = ''
    }
  }, [])

  const center = (i: number) => {
    const el = trackRef.current?.children[i] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  return (
    <div className="carousel">
      <div className="track" ref={trackRef} tabIndex={0} role="group" aria-label={copy.rs.main.kicker}>
        {templates.map((t, i) => (
          <CarouselCard key={t.id} template={t} active={i === active} started={startedThisWeek[t.id] ?? 0} onTap={() => center(i)} />
        ))}
      </div>
    </div>
  )
}

// One card: the with-dot One Light scene fills the top, name + line beneath. The card's own
// printed dot is this surface's single vermilion (no live sphere on the cold open, §0).
function CarouselCard({ template: t, active, started, onTap }: { template: Template; active: boolean; started: number; onTap: () => void }) {
  return (
    <div className={'card' + (active ? ' active' : '')} onClick={onTap}>
      <div className="cardart">
        <img src={cardArt(t.id)} alt="" draggable={false} loading="lazy" decoding="async" />
      </div>
      <div className="cardbody">
        <div className="cname">{t.label}</div>
        <p className="cline">{t.blurb}</p>
        {active && started > 0 && <StartedTag n={started} />}
      </div>
    </div>
  )
}

// The live per-challenge count — shown on the focused card only (CSS hides it off-active).
function StartedTag({ n }: { n: number }) {
  return (
    <span className="clive">
      <svg className="ppl" viewBox="0 0 24 24">
        {P('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2')}
        <circle cx="9" cy="7" r="4" />
        {P('M23 21v-2a4 4 0 0 0-3-3.87')}
      </svg>
      {n.toLocaleString()} started this week
    </span>
  )
}
