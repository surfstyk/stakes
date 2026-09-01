import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, Social } from './model.ts'
import {
  currentDay,
  dayFill,
  isCheckedToday,
  keptDays,
  streak as streakOf,
  weekView,
} from './model.ts'
import { TEMPLATES, type Template } from './templates.ts'
import { ContractCard, Cta, Deck, Frame, HeroDot, Icon, NimiqLink, PopOver, ShareCard, Sphere, Stepper, WeekFrame, Wordmark } from './ui.tsx'
import { SphereWithPick } from './screens2.tsx'

const c = copy.rs

// A light clock so the filling dot rises without a reload. Test mode ticks fast.
function useNow(active: boolean, fast = false): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [active, fast])
  return now
}

// A one-time-per-context hint (auto-shows once, remembered) — JOURNEY §7 open-call 4.
function useOnceFlag(key: string): [boolean, () => void] {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem('stakes.rs.hint.' + key) === '1'
    } catch {
      return false
    }
  })
  const mark = () => {
    try {
      localStorage.setItem('stakes.rs.hint.' + key, '1')
    } catch {
      /* ignore */
    }
    setSeen(true)
  }
  return [seen, mark]
}

// ============================================================================
// 1 · Main — the swipe deck (the new front door)
// ============================================================================
export function MainScreen({ social, onStart, onWordmark }: { social: Social; onStart: (t: Template) => void; onWordmark: () => void }) {
  // Track the card the deck is currently showing so the pinned foot CTA starts THAT one —
  // it used to hardcode TEMPLATES[0], so swiping to another card then tapping the button
  // silently started "No sugar" (rehearsal bug 2026-08-31).
  const [sel, setSel] = useState<Template>(TEMPLATES[0])
  return (
    <Frame foot={<Cta label={c.main.cta} variant="blue" icon={Icon.arrow} onClick={() => onStart(sel)} />}>
      <Wordmark onClick={onWordmark} />
      <div style={{ marginTop: 22 }}>
        <p className="kicker" style={{ margin: '0 0 8px' }}>
          {c.main.kicker}
        </p>
        <h1 className="h">
          {c.main.hLead}
          <em>{c.main.hEm}</em>
          <span className="fs">.</span>
        </h1>
      </div>
      <DeckSelector social={social} onSelect={onStart} onIndexChange={setSel} />
    </Frame>
  )
}

// the deck drives the foot CTA's target as you swipe
function DeckSelector({ social, onSelect, onIndexChange }: { social: Social; onSelect: (t: Template) => void; onIndexChange?: (t: Template) => void }) {
  return <Deck templates={TEMPLATES} startedThisWeek={social.startedThisWeek} onSelect={onSelect} onIndexChange={onIndexChange} />
}

// ============================================================================
// 2 · Taste — day one, the dot filling (time-only, no seal)
// ============================================================================
export function TasteScreen({
  challenge,
  onMakeCount,
  onExit,
  onWordmark,
}: {
  challenge: Challenge
  onMakeCount: () => void
  onExit: () => void
  onWordmark: () => void
}) {
  const now = useNow(true, true)
  const fill = dayFill(challenge, now)
  const label = TEMPLATES.find((t) => t.id === challenge.templateId)?.label ?? challenge.goal
  const [seen, mark] = useOnceFlag('taste')
  const [open, setOpen] = useState(!seen)
  const close = () => {
    setOpen(false)
    mark()
  }
  return (
    <Frame
      sphere={
        <>
          {open && (
            <PopOver variant="hint" onClose={close}>
              <p className="hintline">
                {c.taste.hintPre}
                <em>{c.taste.hintEm}</em>
                {c.taste.hintPost}
              </p>
            </PopOver>
          )}
          <Sphere onClick={() => setOpen(true)} motion={open ? 'lively' : 'calm'} />
        </>
      }
      foot={<Cta label={c.taste.cta} variant="blue" icon={Icon.arrow} onClick={onMakeCount} />}
    >
      <Wordmark onClick={onWordmark} />
      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <div className="goal" style={{ textAlign: 'center' }}>
          {challenge.emoji} {label}
        </div>
        <HeroDot fill={fill} size={136} />
        <h1 className="h" style={{ textAlign: 'center' }}>
          <span className="hh-top">{c.taste.hTop}</span>
          {c.taste.hLead}
          <em>{c.taste.hEm}</em>
          {c.taste.hTail}
          <span className="fs">.</span>
        </h1>
      </div>
      <div style={{ flex: 1 }} />
      <button className="textlink" onClick={onExit} style={{ marginBottom: 8 }}>
        {c.taste.exit}
      </button>
    </Frame>
  )
}

// ============================================================================
// 3 · Make it official — the stake (backdated to the taste start)
// ============================================================================
const PER_DAY = [50, 100, 250, 500]
const LENGTHS = [3, 7, 14, 30]

export function MakeOfficialScreen({
  challenge,
  busy,
  error,
  onOfficial,
  onWordmark,
}: {
  challenge: Challenge
  busy: boolean
  error: string | null
  onOfficial: (stake: { perDay: number; days: number }) => void
  onWordmark: () => void
}) {
  const [pdi, setPdi] = useState(1) // 100 NIM/day
  const [li, setLi] = useState(1) // 7 days
  const [tip, setTip] = useState(false)
  const perDay = PER_DAY[pdi]
  const days = LENGTHS[li]
  const total = perDay * days
  const label = TEMPLATES.find((t) => t.id === challenge.templateId)?.label ?? challenge.goal
  return (
    <Frame
      sphere={
        <>
          {tip && (
            <PopOver variant="hint" onClose={() => setTip(false)}>
              <p className="hintline">
                {c.official.hintPre}
                <em>{c.official.hintEm}</em>
                {c.official.hintPost}
              </p>
            </PopOver>
          )}
          <Sphere onClick={() => setTip(true)} motion={tip ? 'lively' : 'calm'} />
        </>
      }
      foot={<Cta label={busy ? c.official.busy : c.official.cta} variant="blue" onClick={() => onOfficial({ perDay, days })} disabled={busy} />}
    >
      <Wordmark onClick={onWordmark} />
      <div style={{ marginTop: 14 }}>
        <h1 className="h">
          {c.official.hLead}
          <em>{c.official.hEm}</em>
          <span className="fs">.</span>
        </h1>
        <p className="sub" style={{ marginTop: 8, maxWidth: '36ch' }}>
          {c.official.sub}
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <p className="flbl">{c.official.perDayLabel}</p>
        <Stepper
          value={perDay}
          unit={c.official.perDayUnit}
          onDec={() => setPdi((i) => Math.max(0, i - 1))}
          onInc={() => setPdi((i) => Math.min(PER_DAY.length - 1, i + 1))}
          canDec={pdi > 0}
          canInc={pdi < PER_DAY.length - 1}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <p className="flbl">{c.official.lengthLabel}</p>
        <Stepper
          value={days}
          unit={c.official.daysUnit}
          onDec={() => setLi((i) => Math.max(0, i - 1))}
          onInc={() => setLi((i) => Math.min(LENGTHS.length - 1, i + 1))}
          canDec={li > 0}
          canInc={li < LENGTHS.length - 1}
        />
      </div>

      <div className="softcard" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 22, whiteSpace: 'nowrap' }}>
          {total} <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', fontWeight: 700 }}>NIM</span>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.35 }}>
          {c.official.backdateLead}
          <b style={{ color: 'var(--ink)' }}>{c.official.backdateBold}</b>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ContractCard emoji={challenge.emoji} goalLabel={label} seq={challenge.seq} days={days} />
      </div>
      {error && (
        <p className="sub" style={{ color: 'var(--stake)', marginTop: 10 }}>
          {error}
        </p>
      )}
    </Frame>
  )
}

// ============================================================================
// 4/5 · The day screen — today open · today sealed (the daily loop)
// ============================================================================
export function DayScreen({
  challenge,
  busy,
  error,
  onSeal,
  onShare,
  onWordmark,
}: {
  challenge: Challenge
  busy: boolean
  error: string | null
  onSeal: () => void
  onShare: () => void
  onWordmark: () => void
}) {
  const now = useNow(true, true)
  const label = TEMPLATES.find((t) => t.id === challenge.templateId)?.label ?? challenge.goal
  const checked = isCheckedToday(challenge, now)
  const wv = weekView(challenge, now)
  const streak = streakOf(challenge, now)
  const dayNum = currentDay(challenge, now) + 1
  const remaining = challenge.durationDays - keptDays(challenge).size

  return (
    <Frame
      sphere={<SphereWithPick challenge={challenge} />}
      foot={
        checked ? (
          <Cta label={c.day.shareDay(dayNum)} variant="green" icon={Icon.share} onClick={onShare} />
        ) : (
          <Cta label={busy ? c.day.sealing : c.day.cta} variant="green" icon={busy ? undefined : Icon.check} onClick={onSeal} disabled={busy} />
        )
      }
    >
      <Wordmark onClick={onWordmark} />
      <div className="goalrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
        <div className="goal">
          {challenge.emoji} {label}
        </div>
        {streak > 0 && <span className="streakpill">{c.day.streakPill(streak)}</span>}
      </div>

      {checked ? (
        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <p className="kicker go" style={{ margin: '0 0 20px' }}>
            {c.day.sealedKicker(dayNum)}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <HeroDot state="sealed" size={150} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <span className="chip-onchain">
              {Icon.check} {c.day.onchain}
            </span>
          </div>
          <div style={{ marginTop: 26 }}>
            <WeekFrame marks={wv.marks} label={remaining > 0 ? c.day.toGo(remaining) : c.day.lastSealed} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 46 }}>
            <HeroDot fill={dayFill(challenge, now)} size={150} />
          </div>
          <div style={{ marginTop: 40 }}>
            <WeekFrame marks={wv.marks} label={wv.label} />
          </div>
        </>
      )}
      {error && (
        <p className="sub" style={{ color: 'var(--stake)', textAlign: 'center', marginTop: 16 }}>
          {error}
        </p>
      )}
    </Frame>
  )
}

// ============================================================================
// 4 · Seal day one + share — the merged win (the viral ignition)
// ============================================================================
export function SealShareScreen({
  challenge,
  onShare,
  onWordmark,
}: {
  challenge: Challenge
  onShare: () => void
  onWordmark: () => void
}) {
  const stampTx = challenge.checkins.find((k) => k.day === 0)?.stampTxHash
  const href = stampTx && !stampTx.startsWith('mock') ? `https://nimiqscan.com/transaction/${stampTx}` : undefined
  return (
    <Frame
      sphere={<Sphere onClick={() => {}} />}
      foot={<Cta label={c.seal.cta} variant="green" icon={Icon.share} onClick={onShare} />}
    >
      <Wordmark onClick={onWordmark} />
      <div style={{ marginTop: 8 }}>
        <p className="kicker go" style={{ margin: '0 0 5px' }}>
          {c.seal.kicker}
        </p>
        <h1 className="h">
          {c.seal.hLead}
          <span className="fs">.</span>
        </h1>
      </div>
      <div style={{ marginTop: 12 }}>
        <ShareCard
          emoji={challenge.emoji}
          seq={challenge.seq}
          headline={
            <>
              {c.seal.cardTop}
              <br />
              {c.seal.cardBottom}
            </>
          }
        />
      </div>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <NimiqLink href={href} />
      </div>
    </Frame>
  )
}
