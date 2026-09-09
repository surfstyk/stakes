import { useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, DayMark, HistoryItem } from './model.ts'
import { chainSoFar, currentDay, dayCloseInfo, dayFill, keptDays, payoffOf } from './model.ts'
import { pickLine } from './sphere.ts'
import { DEV_TOOLS } from '../lib/flags.ts'
import { journeyArt } from './illus.ts'
import { TEMPLATES } from './templates.ts'
import { ChallengeChip, Cta, DayChain, DotSpeak, Frame, Hex, type HexState, HeroDot, Icon, Ledger, Money, Sphere, StampedRow, TopBar, Wordmark } from './ui.tsx'

const c = copy.rs
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))
const labelOf = (ch: Challenge) => TEMPLATES.find((t) => t.id === ch.templateId)?.label ?? ch.goal

/** The pinned dot that opens its speech bubble (Journey 04b) on tap. A plain tap hands a broad
 *  supportive line; `moment` pins it to a context moment the app read from state — `win` (a sealed
 *  day) or `slip` (a fresh miss). Each tap advances the seed so a re-open re-rolls the line rather
 *  than repeating it. Tap-only — the dot never speaks first (Hendrik's call, 2026-09-08). */
export function SphereWithPick({
  challenge,
  moment,
  meta,
  autoOpen,
  raised,
  motion = 'lively',
}: {
  challenge: Challenge
  moment?: 'win' | 'slip'
  meta?: string
  autoOpen?: boolean
  raised?: boolean
  motion?: 'calm' | 'lively'
}) {
  const [open, setOpen] = useState(() => !!autoOpen || (DEV_TOOLS && new URLSearchParams(location.search).has('pick')))
  const [seed, setSeed] = useState(1)
  const dayIndex = Math.max(0, currentDay(challenge))
  const pick = pickLine(challenge.templateId, dayIndex, seed, moment)
  return (
    <DotSpeak
      open={open}
      onTap={() => {
        setSeed((s) => s + 1) // each tap re-rolls, so a re-open never repeats the last line
        setOpen(true)
      }}
      onClose={() => setOpen(false)}
      motion={motion}
      meta={meta}
      raised={raised}
      line={pick.text}
      source={pick.source}
    />
  )
}

const WHEX2: Record<DayMark, HexState> = { done: 'kept', today: 'today', missed: 'missed', todo: 'future' }
function WeekDots({ marks, size = 18 }: { marks: DayMark[]; size?: number }) {
  return (
    <div className="weekrow" style={{ gap: 9 }}>
      {marks.map((m, i) => (
        <Hex key={i} size={size} state={WHEX2[m]} fill={m === 'today' ? 0.5 : 0} />
      ))}
    </div>
  )
}

// ============================================================================
// ⓻ Banked — the keystone payoff (win · partial · wipeout, burn-not-share)
// ============================================================================
export function BankedScreen({
  challenge,
  onShare,
  onGoAgain,
  onReRun,
  onSeeRecord,
  onHome,
  onWordmark,
}: {
  challenge: Challenge
  onShare: () => void
  onGoAgain: () => void
  onReRun: () => void
  onSeeRecord: () => void
  onHome: () => void
  onWordmark: () => void
}) {
  const p = payoffOf(challenge)
  const label = labelOf(challenge)
  const perDay = Math.round(p.slice)
  const no = String(challenge.seq).padStart(3, '0')
  // a full-run week strip: kept green, the rest burned grey
  const marks: DayMark[] = Array.from({ length: p.total }, (_, i) => (keptDays(challenge).has(i) ? 'done' : 'missed'))

  if (p.outcome === 'banked') {
    return (
      <Frame
        sphere={<SphereWithPick challenge={challenge} moment="win" />}
        // One primary in the fixed slot, so the button never moves; sharing is a quiet action
        // on the win card itself (handoff 2026-09-04).
        foot={<Cta label={c.banked.goAgainWeek} variant="green" icon={Icon.arrow} onClick={onGoAgain} />}
      >
        <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} />} />
        <div style={{ marginTop: 14 }}>
          <p className="kicker go" style={{ margin: '0 0 6px' }}>
            {c.banked.kicker}
          </p>
          <h1 className="h">
            {c.banked.hLead}
            <span className="fs">.</span>
          </h1>
        </div>
        <div style={{ marginTop: 16 }}>
          <WeekDots marks={marks} size={18} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Money
            variant="win"
            label={c.banked.moneyLbl}
            amount={Number(fmt(p.banked))}
            gain={c.banked.gain(Number(fmt(p.bonus)))}
            action={
              <button className="win-share" onClick={onShare}>
                {c.banked.shareWin}
                {Icon.share}
              </button>
            }
          />
        </div>
        <div style={{ marginTop: 13 }}>
          <Ledger
            rows={[
              { k: c.banked.rowStake, v: fmt(p.retained) },
              { k: c.banked.rowBonus, v: `+${fmt(p.bonus)}`, cls: 'plus' },
            ]}
          />
        </div>
      </Frame>
    )
  }

  if (p.outcome === 'partial') {
    return (
      <Frame
        sphere={<SphereWithPick challenge={challenge} raised />}
        foot={
          <div className="rs-foot-stack">
            <button className="ghost" onClick={onSeeRecord}>
              {c.banked.seeRecord}
            </button>
            <Cta label={c.banked.goAgainGoal(label)} variant="blue" icon={Icon.arrow} onClick={onReRun} />
          </div>
        }
      >
        <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} />} />
        <div style={{ marginTop: 14 }}>
          <p className="kicker quiet" style={{ margin: '0 0 6px' }}>
            {c.banked.kickerUp}
          </p>
          <h1 className="h">{c.banked.hPartial(p.kept)}</h1>
        </div>
        <div style={{ marginTop: 16 }}>
          <WeekDots marks={marks} size={18} />
        </div>
        {/* forward framing (design 10 + catalogue rule): the money that came back, the credit for
            the days kept, and the on-chain close — never a "days lost" line. */}
        <div style={{ marginTop: 16 }}>
          <Money variant="neutral" label={c.banked.moneyLbl} amount={Number(fmt(p.retained))} note={c.banked.partialMoneyNote(p.kept, perDay)} />
        </div>
        <p style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 21, lineHeight: 1.18, letterSpacing: '-0.01em', margin: '16px 0 0', maxWidth: '26ch', color: 'var(--ink)' }}>
          {c.banked.partialCredit(p.kept)}
        </p>
        <div style={{ marginTop: 16 }}>
          <StampedRow label={c.banked.closedOnChain(no)} />
        </div>
      </Frame>
    )
  }

  // wipeout
  return (
    <Frame
      sphere={<SphereWithPick challenge={challenge} raised />}
      foot={
        <div className="rs-foot-stack">
          <button className="ghost" onClick={onHome}>
            {c.banked.backHome}
          </button>
          <Cta label={c.banked.tryAgain} variant="blue" icon={Icon.arrow} onClick={onReRun} />
        </div>
      }
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} />} />
      <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p className="kicker quiet" style={{ margin: '0 0 6px', alignSelf: 'flex-start' }}>
          {c.banked.kickerUp}
        </p>
        <h1 className="h" style={{ alignSelf: 'flex-start' }}>
          {c.banked.hWipeout}
        </h1>
        <div style={{ marginTop: 30 }}>
          <WeekDots marks={marks} size={18} />
        </div>
        {/* no "Gone: 700" figure — never name what was lost (catalogue rule) */}
        <p className="sub" style={{ marginTop: 26, maxWidth: '30ch' }}>
          {c.banked.wipeoutNote}
        </p>
        <p className="sub" style={{ marginTop: 16, maxWidth: '30ch' }}>
          {c.banked.wipeoutFwdLead}
          <b>{c.banked.wipeoutFwdBold}</b>
          {c.banked.wipeoutFwdTail}
        </p>
      </div>
    </Frame>
  )
}

// ============================================================================
// ⓾ Re-up — the record (never resets), keep the chain alive
// ============================================================================
export function ReUpScreen({
  challenge,
  record,
  onAnotherWeek,
  onPickNew,
  onWordmark,
}: {
  challenge: Challenge
  record: number
  onAnotherWeek: () => void
  onPickNew: () => void
  onWordmark: () => void
}) {
  const label = labelOf(challenge)
  const dots = Math.min(record, 28)
  return (
    <Frame
      sphere={<SphereWithPick challenge={challenge} raised />}
      foot={
        <div className="rs-foot-stack">
          <button className="ghost" onClick={onPickNew}>
            {c.reup.pickNew}
          </button>
          <Cta label={c.reup.anotherWeek(label)} variant="blue" icon={Icon.arrow} onClick={onAnotherWeek} />
        </div>
      }
    >
      <Wordmark onClick={onWordmark} />
      <div style={{ marginTop: 16 }}>
        <p className="kicker go" style={{ margin: '0 0 7px' }}>
          {c.reup.kicker}
        </p>
        <h1 className="h">
          {c.reup.hLead}
          <em>{c.reup.hEm}</em>
          <span className="fs">.</span>
        </h1>
        <p className="sub" style={{ marginTop: 8 }}>
          {c.reup.sub}
        </p>
      </div>
      <div className="record" style={{ marginTop: 20 }}>
        <div className="rectop">
          <span className="recgoal">{label}</span>
          <span className="recnum">{c.reup.recordNum(record)}</span>
        </div>
        <div className="field">
          {Array.from({ length: dots }, (_, i) => (
            <Hex key={i} size={22} state="kept" />
          ))}
        </div>
      </div>
    </Frame>
  )
}

// ============================================================================
// ⓯ Archive — the no-run home: every run + attempt, tap to run again
// ============================================================================
function whenLabel(ts: number): string {
  const d = Date.now() - ts
  const DAY = 86_400_000
  if (d < 7 * DAY) return c.archive.thisWeek
  if (d < 14 * DAY) return c.archive.lastWeek
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const TAG: Record<HistoryItem['outcome'], { cls: string; label: string }> = {
  banked: { cls: 'tag--banked', label: c.archive.tagBanked },
  partial: { cls: 'tag--partial', label: c.archive.tagPartial },
  lapsed: { cls: 'tag--lapsed', label: c.archive.tagLapsed },
  wipeout: { cls: 'tag--gone', label: c.archive.tagGone },
}

export function ArchiveScreen({
  history,
  onRow,
  onStart,
  onWordmark,
}: {
  history: HistoryItem[]
  onRow: (templateId: string) => void
  onStart: () => void
  onWordmark: () => void
}) {
  return (
    <Frame sphere={<Sphere faded />} foot={<Cta label={c.record.cta} variant="green" icon={Icon.arrow} onClick={onStart} />}>
      <Wordmark onClick={onWordmark} />
      <h1 className="h" style={{ marginTop: 14 }}>
        {c.record.h}
      </h1>
      <p className="sub" style={{ margin: '3px 0 0' }}>
        {c.record.sub}
      </p>
      <div className="list">
        {history.map((h) => {
          const tag = TAG[h.outcome]
          const meta = h.outcome === 'lapsed' ? c.archive.metaLapsed : c.archive.meta(h.kept, h.total, h.stake, whenLabel(h.endedAt))
          return (
            <button key={h.id} className="row" onClick={() => onRow(h.templateId)}>
              <span className="av">
                <img src={journeyArt(h.templateId)} alt="" draggable={false} loading="lazy" decoding="async" />
              </span>
              <div className="mid">
                <div className="rgoal">{labelFromGoal(h)}</div>
                <div className="meta">{meta}</div>
              </div>
              <div className="right">
                <span className={'tag ' + tag.cls}>{tag.label}</span>
                <span className="chev">›</span>
              </div>
            </button>
          )
        })}
      </div>
    </Frame>
  )
}
function labelFromGoal(h: HistoryItem): string {
  return TEMPLATES.find((t) => t.id === h.templateId)?.label ?? h.goal
}

// ============================================================================
// ⓽ Missed — a slice burned, streak resets, record stands (honest, forward)
// ============================================================================
export function MissedScreen({
  challenge,
  onWinToday,
  onWordmark,
}: {
  challenge: Challenge
  onWinToday: () => void
  onWordmark: () => void
}) {
  const kept = keptDays(challenge)
  const keptCount = kept.size
  const perDay = challenge.durationDays ? Math.round(challenge.stake / challenge.durationDays) : 0
  const safe = keptCount * perDay
  const chain = chainSoFar(challenge)
  const fill = dayFill(challenge)
  const close = dayCloseInfo(challenge)
  return (
    <Frame
      // No frost on arrival (mirrors taste, 2026-09-05): the screen stays readable and the dot bobs
      // livelily to invite a tap — the blame-free after-miss line opens only when reached for.
      sphere={<SphereWithPick challenge={challenge} moment="slip" motion="lively" meta={c.clock.moment(close.hoursLeft, close.hhmm)} />}
      foot={<Cta label={c.missed.cta} variant="green" icon={Icon.arrow} onClick={onWinToday} />}
    >
      <TopBar onWordmark={onWordmark} chip={<ChallengeChip challenge={challenge} />} />
      <h1 className="h" style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 26, maxWidth: '15ch' }}>
        {c.missed.h}
      </h1>
      <p className="sub" style={{ marginTop: 10, maxWidth: '31ch', fontSize: 15 }}>
        {c.missed.subOne(perDay, close.hoursLeft)}
      </p>
      <div className="dayhero">
        <HeroDot fill={fill} size={130} />
        <div className="daymoney">
          <p className="dlabel">{c.day.ridingLbl}</p>
          <p className="daybig">
            {perDay} <small>NIM</small>
          </p>
          <p className="sub">{c.missed.ridingNote}</p>
        </div>
      </div>
      {keptCount > 0 && <DayChain marks={chain} keptCount={keptCount} safe={safe} todayFill={fill} />}
    </Frame>
  )
}

// ============================================================================
// ⓼ Lapsed — the taste's 24h passed without a commit (no shame, restartable)
// ============================================================================
export function LapsedScreen({ onStartAgain, onWordmark }: { challenge: Challenge; onStartAgain: () => void; onWordmark: () => void }) {
  return (
    <Frame foot={<Cta label={c.lapsed.cta} variant="blue" icon={Icon.arrow} onClick={onStartAgain} />}>
      <Wordmark onClick={onWordmark} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 56 }}>
        <HeroDot state="faded" size={132} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <h1 className="h" style={{ textAlign: 'center' }}>
          {c.lapsed.hLead}
          <span className="fs">.</span>
        </h1>
        <p className="sub" style={{ margin: '12px auto 0', maxWidth: '31ch', textAlign: 'center' }}>
          {c.lapsed.sub}
        </p>
      </div>
    </Frame>
  )
}
