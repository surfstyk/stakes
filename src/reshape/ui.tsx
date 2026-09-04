import { type ReactNode, useId, useRef, useState } from 'react'
import { type PanInfo, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { RATIO, SQ3, roundedHex } from '../brand/hex.ts'
import { copy } from '../brand/index.ts'
import { type Challenge, currentDay, effectiveStatus, type DayMark } from './model.ts'
import { TEMPLATES, type Template } from './templates.ts'
import { cardArt, illusOn, journeyArt } from './illus.ts'

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
export function Sphere({ onClick, raised, motion = 'calm' }: { onClick?: () => void; raised?: boolean; motion?: 'calm' | 'lively' }) {
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
// A day is a hex. fill = time (rising bottom-up) · solid = you (with the bead).
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
  const H = SQ3 * R
  const shell = roundedHex(R, H / 2, R, RATIO * R)
  const beadR = RATIO * R
  const shellFill =
    state === 'kept' || state === 'sealed'
      ? 'var(--go)'
      : state === 'missed'
        ? 'var(--grey)'
        : state === 'future'
          ? 'transparent'
          : '#e3ddcf' // today / faded shell
  const rise = fillColor ?? (state === 'today' ? 'var(--go)' : null)
  const bead = state === 'kept'
  return (
    <span className="hex" style={{ display: 'inline-block', position: 'relative', width: size, height: H, lineHeight: 0 }}>
      <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <clipPath id={'hc' + uid}>
            <path d={shell} />
          </clipPath>
          {bead && (
            <radialGradient id={'hb' + uid} cx="34%" cy="28%" r="72%">
              <stop offset="0" stopColor="#ff8a4a" />
              <stop offset="0.18" stopColor="#ff7a3f" />
              <stop offset="0.55" stopColor="#ef2d06" />
              <stop offset="1" stopColor="#b81f04" />
            </radialGradient>
          )}
        </defs>
        <path d={shell} fill={shellFill} stroke={state === 'future' ? '#cfc6b4' : 'none'} strokeWidth={state === 'future' ? 2 : 0} />
        {rise && fill > 0 && <rect x={0} y={H * (1 - fill)} width={size} height={H * fill} fill={rise} clipPath={`url(#hc${uid})`} />}
        {bead && <circle cx={R} cy={H / 2} r={beadR} fill={`url(#hb${uid})`} />}
      </svg>
      {children != null && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</span>}
    </span>
  )
}

// ---- the hero dot — now the hero HEX (§11.3: the sealed hero keeps the cream check) ----
export function HeroDot({
  fill = 0,
  state = 'filling',
  size = 140,
  emoji,
}: {
  fill?: number
  state?: 'filling' | 'sealed' | 'missed' | 'faded'
  size?: number
  emoji?: string
}) {
  const w = Math.round(size / 0.866) // a flat-top hex is 0.866× as tall as wide — widen to hold the old presence
  if (state === 'sealed') {
    return (
      <span className="heroHex sealed">
        <Hex size={w} state="sealed">
          <span className="heroCheck">{Icon.check}</span>
        </Hex>
      </span>
    )
  }
  if (state === 'faded') {
    return (
      <span className="heroHex faded">
        <Hex size={w} state="today" fill={0.5} fillColor="var(--grey)">
          <span className="heroEmoji">{emoji}</span>
        </Hex>
      </span>
    )
  }
  // filling + missed both rise bottom-up; missed rises in grey and keeps its level
  return (
    <span className="heroHex">
      <Hex size={w} state="today" fill={fill} fillColor={state === 'missed' ? 'var(--grey)' : undefined} />
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

// ---- the contract card (backdates: day one already kept + OFFICIAL) ---------
export function ContractCard({ emoji, goalLabel, seq, days }: { emoji: string; goalLabel: string; seq: number; days: number }) {
  const no = String(seq).padStart(3, '0')
  return (
    <div className="contract">
      <div className="cg">
        {emoji} {goalLabel}
      </div>
      <div className="csn">{days === 7 ? copy.rs.official.contractWeek : copy.rs.official.contractDaysN(days)} · {copy.rs.official.contractNo(no)}</div>
      <div className="cw">
        <span className="dot dot--kept" />
        {Array.from({ length: Math.max(0, days - 1) }, (_, i) => (
          <span key={i} className="dot dot--future" />
        ))}
        <span className="stamp-official" style={{ marginLeft: 'auto' }}>
          {copy.rs.official.stamp}
        </span>
      </div>
    </div>
  )
}

// ---- the shareable trophy card + the Nimiq on-chain proof -------------------
export function ShareCard({ emoji, seq, headline, stamp = copy.rs.shareCard.stampRecord }: { emoji: string; seq: number; headline: ReactNode; stamp?: string }) {
  return (
    <div className="sharecard">
      <div className="sc-top">
        <span className="wm2">
          Stakes<span className="fs">.</span>
        </span>
        <span className="sc-no">{copy.rs.shareCard.no(String(seq).padStart(3, '0'))}</span>
      </div>
      <div className="sc-emoji">{emoji}</div>
      <div className="sc-h">{headline}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Hex size={22} state="kept" />
      </div>
      <span className="stamp-record">{stamp}</span>
      {/* the traveling sign-off carries the claim: the name + the hook (story.md §7) */}
      <div className="sc-cta">
        {copy.claim.name} · {copy.claim.hook}
      </div>
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

// ---- the swipe deck: a stack you flick through ------------------------------
// Cards lie in a stack; the top one is draggable. Flick it far enough (or fast enough) and it
// flies off-screen while the card underneath rises into its place — physically like dealing off
// the top of a deck (handoff feedback 2026-09-04). Motion (already a dependency) owns the
// gesture: it runs the drag off the React render loop, disambiguates tap-vs-drag automatically
// (a >3px move cancels the tap), and re-seats on an animation-complete promise, not a fragile
// CSS transitionend — which is what made the hand-rolled version feel "blocked" and mis-tap.
export function Deck({
  templates,
  startedThisWeek,
  onSelect,
  onIndexChange,
}: {
  templates: Template[]
  startedThisWeek: Record<string, number>
  onSelect: (t: Template) => void
  onIndexChange?: (t: Template) => void
}) {
  const [index, setIndex] = useState(0)
  const n = templates.length
  const at = (o: number) => templates[(index + o) % n]
  // the visible stack: the top card + the two beneath it
  const stack = [at(0), at(1), at(2)]

  const advance = () => {
    const next = (index + 1) % n
    setIndex(next)
    onIndexChange?.(templates[next])
  }

  return (
    <>
      <div className="deck">
        {stack.map((t, i) => (
          <DeckCard key={t.id} template={t} depth={i} interactive={i === 0} started={startedThisWeek[t.id] ?? 0} onSelect={() => onSelect(t)} onFlung={advance} />
        ))}
      </div>
      <div className="dots">
        {templates.map((t, i) => (
          <span key={t.id} className={'pd' + (i === index ? ' on' : '')} />
        ))}
      </div>
    </>
  )
}

// One card. The interactive (top) one drags; the two beneath spring to their depth. Each card
// owns its own motion value keyed by template id, so a flung card (which unmounts) never leaks a
// stale offset onto the card that rises to take its place.
function DeckCard({
  template: t,
  depth,
  interactive,
  started,
  onSelect,
  onFlung,
}: {
  template: Template
  depth: number
  interactive: boolean
  started: number
  onSelect: () => void
  onFlung: () => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-15, 15])
  const [flinging, setFlinging] = useState(false)
  // Motion fires onTap AND onDragEnd for a drag (they are independent recognizers), so a swipe
  // would otherwise also count as a tap and start the challenge. Track whether a drag actually
  // began and let a tap select ONLY when it didn't (handoff bug 2026-09-04).
  const dragged = useRef(false)

  const body = (
    <>
      <div className="cname">{t.label}</div>
      <p className="cline">{t.blurb}</p>
      {interactive && started > 0 && <StartedTag n={started} />}
    </>
  )
  return (
    <motion.div
      className={'card' + (illusOn ? ' illus' : '')}
      style={interactive ? { x, rotate, zIndex: 4 } : { zIndex: 4 - depth }}
      animate={{ y: interactive ? 0 : depth * 16, scale: interactive ? 1 : 1 - depth * 0.05, opacity: !interactive && depth >= 2 ? 0.92 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      drag={interactive && !flinging ? 'x' : false}
      onPointerDownCapture={interactive ? () => (dragged.current = false) : undefined}
      onDragStart={interactive ? () => (dragged.current = true) : undefined}
      onTap={interactive ? () => !dragged.current && onSelect() : undefined}
      onDragEnd={
        interactive
          ? (_, info: PanInfo) => {
              // a real flick counts by distance OR speed, so a fast short flick still fires
              const flung = Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500
              if (!flung) {
                void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40, velocity: info.velocity.x }) // springs home
                return
              }
              setFlinging(true)
              const dir = info.offset.x < 0 ? -1 : 1
              const w = typeof window !== 'undefined' ? window.innerWidth : 420
              void animate(x, dir * w * 1.15, { type: 'spring', stiffness: 550, damping: 46, velocity: info.velocity.x }).then(onFlung)
            }
          : undefined
      }
    >
      {illusOn ? (
        <>
          {/* picture-forward: the with-dot scene fills the top, name + line beneath (board B) */}
          <div className="cardart">
            <img src={cardArt(t.id)} alt="" draggable={false} loading="lazy" decoding="async" />
          </div>
          <div className="cardbody">{body}</div>
        </>
      ) : (
        <>
          <div className="medallion">{t.emoji}</div>
          {body}
        </>
      )}
    </motion.div>
  )
}

function StartedTag({ n }: { n: number }) {
  return (
    <>
      <div className="cdiv" />
      <span className="clive">
        <svg className="ppl" viewBox="0 0 24 24">
          {P('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2')}
          <circle cx="9" cy="7" r="4" />
          {P('M23 21v-2a4 4 0 0 0-3-3.87')}
        </svg>
        {n.toLocaleString()} started this week
      </span>
    </>
  )
}
