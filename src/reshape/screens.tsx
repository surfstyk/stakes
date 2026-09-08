import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, Social } from './model.ts'
import { chainSoFar, currentDay, dayFill, isCheckedToday, keptDays } from './model.ts'
import { TEMPLATES, type Template } from './templates.ts'
import { Carousel, Chain, ChallengeChip, ContractCard, Cta, DotSpeak, Frame, HeroDot, Icon, ShareCard, Sphere, StampedRow, Stepper, TopBar, Wordmark } from './ui.tsx'
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
      <CarouselSelector social={social} onIndexChange={setSel} />
    </Frame>
  )
}

// the centred card drives the foot CTA's target as you browse; the button is the only commit
function CarouselSelector({ social, onIndexChange }: { social: Social; onIndexChange?: (t: Template) => void }) {
  return <Carousel templates={TEMPLATES} startedThisWeek={social.startedThisWeek} onIndexChange={onIndexChange} />
}

// ============================================================================
// 2 · Taste — day one, the dot filling (time-only, no seal)
// ============================================================================
export function TasteScreen({
  challenge,
  onMakeCount,
  onPicker,
  onWordmark,
}: {
  challenge: Challenge
  onMakeCount: () => void
  onPicker: () => void
  onWordmark: () => void
}) {
  const now = useNow(true, true)
  const fill = dayFill(challenge, now)
  // First contact: no frost on arrival. The dot just bobs livelily to invite a tap; the hint
  // pop-over opens only when the user reaches for it (handoff 2026-09-04).
  const [open, setOpen] = useState(false)
  return (
    <Frame
      sphere={
        <DotSpeak
          open={open}
          onTap={() => setOpen(true)}
          onClose={() => setOpen(false)}
          motion="lively"
          line={`${c.taste.hintPre}${c.taste.hintEm}${c.taste.hintPost}`}
        />
      }
      foot={<Cta label={c.taste.cta} variant="blue" icon={Icon.arrow} onClick={onMakeCount} />}
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} onPicker={onPicker} />} />
      <h1 className="h" style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 26, maxWidth: '16ch' }}>
        {c.taste.hTop} {c.taste.hLead}
        {c.taste.hEm}
        {c.taste.hTail}.
      </h1>
      <p className="sub" style={{ marginTop: 10, maxWidth: '30ch', fontSize: 15 }}>
        {c.taste.sub}
      </p>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center' }}>
        <HeroDot fill={fill} size={240} />
      </div>
      <p className="dlabel" style={{ marginTop: 16, textAlign: 'center' }}>
        Day one · free · nothing at stake yet
      </p>
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
  onPicker,
  onWordmark,
}: {
  challenge: Challenge
  busy: boolean
  error: { kind: 'cancel' | 'error' } | null
  onOfficial: (stake: { perDay: number; days: number }) => void
  onPicker: () => void
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
        <DotSpeak
          open={tip}
          onTap={() => setTip(true)}
          onClose={() => setTip(false)}
          motion="lively"
          line={`${c.official.hintPre}${c.official.hintEm}${c.official.hintPost}`}
        />
      }
      foot={<Cta label={busy ? c.official.busy : c.official.cta} variant="blue" onClick={() => onOfficial({ perDay, days })} disabled={busy} />}
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} onPicker={onPicker} />} />
      <div style={{ marginTop: 16 }}>
        <h1 className="h" style={{ fontSize: 32, maxWidth: '18ch' }}>
          {c.official.hLead}
          <em>{c.official.hEm}</em>
          <span className="fs">.</span>
        </h1>
        <p className="sub" style={{ marginTop: 8 }}>
          {c.official.sub}
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
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
      <div style={{ marginTop: 10 }}>
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

      <div style={{ marginTop: 12 }}>
        <ContractCard goalLabel={label} total={total} perDay={perDay} />
      </div>
      {error && (
        <p className="sub" style={{ color: error.kind === 'cancel' ? 'var(--ink-soft)' : 'var(--stake)', marginTop: 10 }}>
          {error.kind === 'cancel' ? c.official.errCancel : c.official.err}
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
  error: { kind: 'cancel' | 'error' } | null
  onSeal: () => void
  onShare: () => void
  onWordmark: () => void
}) {
  const now = useNow(true, true)
  const checked = isCheckedToday(challenge, now)
  const cur = currentDay(challenge, now)
  const kept = keptDays(challenge)
  const keptCount = kept.size
  const perDay = challenge.durationDays ? Math.round(challenge.stake / challenge.durationDays) : 0
  const safe = keptCount * perDay
  const chain = chainSoFar(challenge, now)
  const dayNum = cur + 1
  const stampTx = challenge.checkins.find((k) => k.day === cur)?.stampTxHash
  const stampHref = stampTx && !stampTx.startsWith('mock') ? `https://nimiqscan.com/transaction/${stampTx}` : undefined

  return (
    <Frame
      sphere={<SphereWithPick challenge={challenge} moment={checked ? 'win' : undefined} />}
      foot={
        checked ? (
          <Cta label="Show someone" variant="blue" icon={Icon.share} onClick={onShare} />
        ) : (
          <Cta label={busy ? c.day.sealing : c.day.cta} variant="green" icon={busy ? undefined : Icon.check} onClick={onSeal} disabled={busy} />
        )
      }
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} />} />

      {checked ? (
        <>
          <h1 className="h" style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 26 }}>
            Banked the day.
          </h1>
          <p className="sub" style={{ marginTop: 10, maxWidth: '30ch', fontSize: 15 }}>
            {safe} NIM is now yours to lose only by stopping.
          </p>
          <div style={{ marginTop: 18, alignSelf: 'center', filter: 'drop-shadow(0 6px 14px rgba(12,95,53,.3))' }}>
            <HeroDot state="sealed" size={150} />
          </div>
          <div className="selledger" style={{ marginTop: 16 }}>
            <div className="selrow">
              <span className="k">Today, kept</span>
              <span className="v go">+{perDay}</span>
            </div>
            <div className="selrow">
              <span className="k">Safe so far</span>
              <span className="v go">{safe}</span>
            </div>
            <div className="selrow">
              <span className="k">Days kept</span>
              <span className="v">{keptCount}</span>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <StampedRow label={`Day ${dayNum} is stamped on Nimiq`} href={stampHref} />
          </div>
        </>
      ) : (
        <>
          <h1 className="h" style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 26, maxWidth: '16ch' }}>
            Today is the whole game.
          </h1>
          <p className="sub" style={{ marginTop: 10, maxWidth: '30ch', fontSize: 15 }}>
            Do it once today, any way you like. The window is open until midnight.
          </p>
          <div className="dayhero">
            <HeroDot fill={dayFill(challenge, now)} size={130} />
            <div className="daymoney">
              <p className="dlabel">Riding on today</p>
              <p className="daybig">
                {perDay} <small>NIM</small>
              </p>
              <p className="sub">Win it and it&apos;s yours. That&apos;s the only number that matters right now.</p>
            </div>
          </div>
          {keptCount > 0 && (
            <div className="daychain">
              <Chain marks={chain} size={22} fill={dayFill(challenge, now)} />
              <div className="cn-txt">
                <p className="cn-lead">{keptCount === 1 ? 'One day banked' : `${keptCount} days banked`}</p>
                <p className="cn-safe">{safe} NIM safe · yours whatever happens</p>
              </div>
            </div>
          )}
          {error && (
            <p className="sub" style={{ color: 'var(--stake)', marginTop: 16 }}>
              {c.day.err}
            </p>
          )}
        </>
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
  const dayNum = currentDay(challenge) + 1
  const no = String(challenge.seq).padStart(3, '0')
  return (
    <Frame
      sphere={<Sphere onClick={() => {}} />}
      foot={<Cta label="Share it" variant="blue" icon={Icon.share} onClick={onShare} />}
    >
      <TopBar onWordmark={onWordmark} chip={<span className="rs-no">Nº {no} · Day {dayNum}</span>} />
      <h1 className="h" style={{ fontSize: 32, marginTop: 18 }}>
        Worth showing<span className="fs">.</span>
      </h1>
      <div style={{ marginTop: 14 }}>
        <ShareCard
          templateId={challenge.templateId}
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
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <StampedRow label="See it on the chain" href={href} />
      </div>
    </Frame>
  )
}
