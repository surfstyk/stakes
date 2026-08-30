import { type ReactNode, useRef, useState } from 'react'
import { copy } from '../brand/index.ts'
import type { DayMark } from './model.ts'
import type { Template } from './templates.ts'

// The shared primitives, ported one-for-one from the finished artboards
// (surfstyk-notes/brand/onboarding-v2/). Faithful, not reskinned. Class names match
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
export function Sphere({ onClick, raised }: { onClick?: () => void; raised?: boolean }) {
  return (
    <button className={'sphereFab' + (raised ? ' raised' : '')} onClick={onClick} aria-label={copy.a11y.openSphere}>
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

// ---- the hero dot -----------------------------------------------------------
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
  const style = { width: size, height: size }
  if (state === 'sealed') {
    return (
      <div className="heroDot sealed" style={style}>
        <span className="seal">{Icon.check}</span>
      </div>
    )
  }
  if (state === 'faded') {
    return (
      <div className="heroDot faded" style={style}>
        <span className="liquid" />
        <span className="goalEmoji">{emoji}</span>
      </div>
    )
  }
  return (
    <div className={'heroDot' + (state === 'missed' ? ' missed' : '')} style={style}>
      <span className="liquid" style={{ height: `${Math.round(fill * 100)}%` }} />
      <span className="glass" />
    </div>
  )
}

// ---- the week frame ---------------------------------------------------------
const WD: Record<DayMark, string> = { done: 'wd--kept', today: 'wd--today', missed: 'wd--missed', todo: 'wd--future' }
export function WeekFrame({ marks, label }: { marks: DayMark[]; label?: string }) {
  return (
    <div className="weekframe">
      <div className="weekrow">
        {marks.map((m, i) => (
          <span key={i} className={'wd ' + WD[m]} />
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
        <span className="dot dot--kept" style={{ width: 22, height: 22 }} />
      </div>
      <span className="stamp-record">{stamp}</span>
      <div className="sc-cta">{copy.rs.shareCard.cta}</div>
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
}: {
  variant: 'win' | 'neutral' | 'quiet'
  label: string
  amount: number
  unit?: string
  gain?: string
  note?: string
}) {
  return (
    <div className={`money money--${variant}`}>
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
        <span key={i} className="rwd" style={{ transform: `translate(${x}px,${y}px)` }} />
      ))}
    </div>
  )
}

// ---- the swipe deck ---------------------------------------------------------
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
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<number | null>(null)
  const n = templates.length
  const at = (o: number) => templates[(index + o + n) % n]
  const cur = at(0)
  const started = startedThisWeek[cur.id] ?? 0

  const move = (dir: -1 | 1) => {
    const next = (index + dir + n) % n
    setIndex(next)
    onIndexChange?.(templates[next])
  }

  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientX
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (start.current == null) return
    setDragX(e.clientX - start.current)
  }
  const onUp = () => {
    const dx = dragX
    start.current = null
    setDragging(false)
    setDragX(0)
    if (Math.abs(dx) < 8) {
      onSelect(cur) // a tap = pick this one
    } else if (Math.abs(dx) > 56) {
      move(dx < 0 ? 1 : -1)
    }
  }

  return (
    <>
      <div className="deck">
        <div className="peek l">{at(-1).emoji}</div>
        <div className="peek r">{at(1).emoji}</div>
        <div
          className={'card' + (dragging ? ' swiping' : ' settle')}
          style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.02}deg)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="medallion">{cur.emoji}</div>
          <div className="cname">{cur.label}</div>
          <p className="cline">{cur.blurb}</p>
          {started > 0 && (
            <>
              <div className="cdiv" />
              <span className="clive">
                <svg className="ppl" viewBox="0 0 24 24">
                  {P('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2')}
                  <circle cx="9" cy="7" r="4" />
                  {P('M23 21v-2a4 4 0 0 0-3-3.87')}
                </svg>
                {started.toLocaleString()} started this week
              </span>
            </>
          )}
        </div>
      </div>
      <div className="dots">
        {templates.map((t, i) => (
          <span key={t.id} className={'pd' + (i === index ? ' on' : '')} />
        ))}
      </div>
    </>
  )
}
