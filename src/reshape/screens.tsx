import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, Social } from './model.ts'
import { chainSoFar, currentDay, dayCloseInfo, dayFill, isCheckedToday, keptDays, streak } from './model.ts'
import { TEMPLATES, type Template } from './templates.ts'
import { Carousel, Chain, ChallengeChip, ContractCard, Cta, DayChain, DotSpeak, Frame, HeroDot, Icon, ShareCard, StampedRow, Stepper, TopBar, Wordmark } from './ui.tsx'
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
      <p className="dlabel" style={{ textAlign: 'center', marginTop: 12 }}>
        {c.main.pager(TEMPLATES.length)}
      </p>
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
  // First contact: no frost on arrival. The dot bobs livelily to invite a tap; on tap it hands a
  // curated line for the moment — this is the trier→committer beat, so it must speak, not show a
  // static "I'm the dot" intro (bug found in demo 2026-09-08). SphereWithPick owns the open state.
  return (
    <Frame
      sphere={<SphereWithPick challenge={challenge} />}
      foot={<Cta label={c.taste.cta} variant="blue" icon={Icon.arrow} onClick={onMakeCount} />}
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} onPicker={onPicker} />} />
      <h1 className="h" style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 26, maxWidth: '16ch' }}>
        {c.taste.h}
      </h1>
      <p className="sub" style={{ marginTop: 10, maxWidth: '30ch', fontSize: 15 }}>
        {c.taste.sub}
      </p>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center' }}>
        <HeroDot fill={fill} size={240} />
      </div>
      <p className="dlabel" style={{ marginTop: 16, textAlign: 'center' }}>
        {c.taste.caption}
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
  const perDay = PER_DAY[pdi]
  const days = LENGTHS[li]
  const total = perDay * days
  const label = TEMPLATES.find((t) => t.id === challenge.templateId)?.label ?? challenge.goal
  return (
    <Frame
      sphere={<SphereWithPick challenge={challenge} />}
      foot={<Cta label={busy ? c.official.busy : c.official.cta} variant="blue" onClick={() => onOfficial({ perDay, days })} disabled={busy} />}
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} onPicker={onPicker} />} />
      <div style={{ marginTop: 16 }}>
        <h1 className="h" style={{ fontSize: 32, maxWidth: '18ch' }}>
          {c.official.h}
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
  onShowSomeone,
  onWordmark,
}: {
  challenge: Challenge
  busy: boolean
  error: { kind: 'cancel' | 'error' } | null
  onSeal: () => void
  onShowSomeone: () => void
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
  const close = dayCloseInfo(challenge, now)
  const streakCount = streak(challenge, now)
  const dayNum = cur + 1
  const stampTx = challenge.checkins.find((k) => k.day === cur)?.stampTxHash
  const stampHref = stampTx && !stampTx.startsWith('mock') ? `https://nimiqscan.com/transaction/${stampTx}` : undefined

  return (
    <Frame
      sphere={
        checked ? (
          // 06: the day is won, the dot has nothing to add → faded 25%, inert (design rule).
          <DotSpeak open={false} onTap={() => {}} onClose={() => {}} faded />
        ) : (
          // 04/04b: the dot carries the time context in its bubble meta ("9h left · closes 06:41").
          <SphereWithPick challenge={challenge} meta={c.clock.moment(close.hoursLeft, close.hhmm)} />
        )
      }
      foot={
        checked ? (
          <Cta label={c.day.showSomeone} variant="blue" icon={Icon.share} onClick={onShowSomeone} />
        ) : (
          <Cta label={busy ? c.day.sealing : c.day.cta} variant="green" icon={busy ? undefined : Icon.check} onClick={onSeal} disabled={busy} />
        )
      }
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} />} />

      {checked ? (
        <>
          <h1 className="h" style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 26 }}>
            {c.day.sealedH}
          </h1>
          <p className="sub" style={{ marginTop: 10, maxWidth: '30ch', fontSize: 15 }}>
            {c.day.sealedSub(safe)}
          </p>
          <div style={{ marginTop: 14, alignSelf: 'center', filter: 'drop-shadow(0 6px 14px rgba(12,95,53,.3))' }}>
            <HeroDot state="sealed" size={140} />
          </div>
          <div className="selledger" style={{ marginTop: 14 }}>
            <div className="selrow">
              <span className="k">{c.day.ledgerToday}</span>
              <span className="v go">+{perDay}</span>
            </div>
            <div className="selrow">
              <span className="k">{c.day.ledgerSafe}</span>
              <span className="v go">{safe}</span>
            </div>
            <div className="selrow">
              <span className="k">{c.day.ledgerDays}</span>
              <span className="v">{keptCount}</span>
            </div>
          </div>
          <div className="selstreak">
            <Chain marks={chain.slice(-10)} size={28} />
            <p className="selstreak-lbl">{c.chain.inARow(streakCount)}</p>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 14 }}>
            <StampedRow label={c.day.stamped(dayNum)} href={stampHref} />
          </div>
        </>
      ) : (
        <>
          {/* Returning to a rolled-over day: name the banked days as safe and today as a fresh day,
              so the CTA below reads as a NEW day's move, not a re-sign of what you already did
              (bug report 2026-09-11). Only when something is already banked (cur ≥ 1). */}
          {keptCount > 0 && (
            <p className="kicker" style={{ marginTop: 26, marginBottom: 8 }}>
              {c.day.contKicker(keptCount, dayNum)}
            </p>
          )}
          <h1 className="h" style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', marginTop: keptCount > 0 ? 0 : 26, maxWidth: '16ch' }}>
            {c.day.h}
          </h1>
          <p className="sub" style={{ marginTop: 10, maxWidth: '32ch', fontSize: 15 }}>
            {c.day.sub(close.hhmm, close.hoursLeft, close.tomorrow)}
          </p>
          <div className="dayhero">
            <HeroDot fill={dayFill(challenge, now)} size={130} />
            <div className="daymoney">
              <p className="dlabel">{c.day.ridingLbl}</p>
              <p className="daybig">
                {perDay} <small>NIM</small>
              </p>
              <p className="sub">{c.day.ridingNote}</p>
            </div>
          </div>
          {keptCount > 0 && <DayChain marks={chain} keptCount={keptCount} safe={safe} todayFill={dayFill(challenge, now)} />}
          {/* The banked win stays shareable after the day rolls: this link raises the same 07 postcard
              (for the most recent kept day), so yesterday's proof is never stranded (bug report 2026-09-11). */}
          {keptCount > 0 && (
            <button className="textlink" onClick={onShowSomeone} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              {c.day.showSomeone}
            </button>
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
  // Show the most recent BANKED day, not the open one — so this postcard works both right after a
  // seal (that day is the newest kept) and when raised later from an unsealed day's "Show someone"
  // link (it shows yesterday's kept day + its proof, never a blank not-yet-sealed day).
  const keptSet = keptDays(challenge)
  const cur = keptSet.size ? Math.max(...keptSet) : currentDay(challenge)
  const kept = keptSet.size
  const perDay = challenge.durationDays ? Math.round(challenge.stake / challenge.durationDays) : 0
  const safe = kept * perDay
  const stampTx = challenge.checkins.find((k) => k.day === cur)?.stampTxHash
  const href = stampTx && !stampTx.startsWith('mock') ? `https://nimiqscan.com/transaction/${stampTx}` : undefined
  const no = String(challenge.seq).padStart(3, '0')
  return (
    <Frame
      // 07: the postcard runs on every seal, not just day one; the dot stays faded here too.
      sphere={<DotSpeak open={false} onTap={() => {}} onClose={() => {}} faded />}
      foot={<Cta label={c.share.cta} variant="blue" icon={Icon.share} onClick={onShare} />}
    >
      <TopBar onWordmark={onWordmark} chip={<span className="rs-no">Nº {no} · Day {cur + 1}</span>} />
      <h1 className="h" style={{ fontSize: 32, marginTop: 18 }}>
        {c.share.h}
      </h1>
      <div style={{ marginTop: 14 }}>
        <ShareCard
          templateId={challenge.templateId}
          seq={challenge.seq}
          headline={
            <>
              {c.share.cardTop(kept)}
              <br />
              {c.share.cardBottom(safe)}
            </>
          }
        />
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <StampedRow label={c.share.proof} href={href} />
      </div>
    </Frame>
  )
}
