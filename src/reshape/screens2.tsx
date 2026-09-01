import { useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, DayMark, HistoryItem } from './model.ts'
import { currentDay, keptDays, payoffOf, weekView } from './model.ts'
import { pickLine } from './sphere.ts'
import { DEV_TOOLS } from '../lib/flags.ts'
import { TEMPLATES } from './templates.ts'
import { Cta, Frame, Hex, type HexState, HeroDot, Icon, Ledger, Money, PerfectRing, PopOver, Sphere, WeekFrame, Wordmark } from './ui.tsx'

const c = copy.rs
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))
const labelOf = (ch: Challenge) => TEMPLATES.find((t) => t.id === ch.templateId)?.label ?? ch.goal

// ---- the sphere's tap → curated pick (a line for a weak moment) -------------
function shareText(text: string) {
  try {
    if (navigator.share) {
      void navigator.share({ text, url: location.origin })
      return
    }
  } catch {
    /* cancelled / unsupported */
  }
  try {
    void navigator.clipboard?.writeText(`${text} ${location.origin}`)
  } catch {
    /* ignore */
  }
}

export function SpherePickPop({ challenge, tap, onClose }: { challenge: Challenge; tap: number; onClose: () => void }) {
  const dayIndex = Math.max(0, currentDay(challenge))
  const pick = pickLine(challenge.templateId, dayIndex, challenge.durationDays || 7, tap)
  return (
    <PopOver variant="pick" onClose={onClose}>
      <span className="ctx">
        <span className="d" />
        {c.sphere.pickCtx(labelOf(challenge), dayIndex + 1)}
      </span>
      <p className="quote">{pick.text}</p>
      {pick.source && (
        <p className="sub" style={{ margin: '8px 0 0', fontStyle: 'italic' }}>
          — {pick.source}
        </p>
      )}
      <div className="hr" />
      <button className="share" onClick={() => shareText(pick.text)}>
        {Icon.share}
        {c.sphere.pickShare}
      </button>
    </PopOver>
  )
}

/** The pinned sphere that opens (and re-rolls) the pick on tap. Each tap advances the
 *  seed and shows the pop-over; closing (tap-outside) hides it but KEEPS the seed, so the
 *  next open re-rolls to a new line instead of repeating pick #1 (rehearsal bug 2026-08-31). */
export function SphereWithPick({ challenge, raised }: { challenge: Challenge; raised?: boolean }) {
  const [open, setOpen] = useState(() => DEV_TOOLS && new URLSearchParams(location.search).has('pick'))
  const [seed, setSeed] = useState(1)
  const tapSphere = () => {
    setSeed((s) => s + 1)
    setOpen(true)
  }
  return (
    <>
      {open && <SpherePickPop challenge={challenge} tap={seed} onClose={() => setOpen(false)} />}
      <Sphere raised={raised} onClick={tapSphere} />
    </>
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
  // a full-run week strip: kept green, the rest burned grey
  const marks: DayMark[] = Array.from({ length: p.total }, (_, i) => (keptDays(challenge).has(i) ? 'done' : 'missed'))

  if (p.outcome === 'banked') {
    return (
      <Frame
        foot={
          <div className="rs-foot-stack">
            <button className="ghost" onClick={onGoAgain}>
              {c.banked.goAgainWeek}
            </button>
            <Cta label={c.banked.shareWin} variant="green" icon={Icon.share} onClick={onShare} />
          </div>
        }
      >
        <Wordmark onClick={onWordmark} />
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
          <Money variant="win" label={c.banked.moneyLbl} amount={Number(fmt(p.banked))} gain={c.banked.gain(Number(fmt(p.bonus)))} />
        </div>
        <div style={{ marginTop: 13 }}>
          <Ledger
            rows={[
              { k: c.banked.rowStake, v: fmt(p.retained) },
              { k: c.banked.rowBonus, v: `+${fmt(p.bonus)}`, cls: 'plus' },
              { k: c.banked.rowBanked, v: `${fmt(p.banked)} NIM`, cls: 'tot' },
            ]}
          />
        </div>
      </Frame>
    )
  }

  if (p.outcome === 'partial') {
    return (
      <Frame
        foot={
          <div className="rs-foot-stack">
            <button className="ghost" onClick={onSeeRecord}>
              {c.banked.seeRecord}
            </button>
            <Cta label={c.banked.goAgainGoal(label)} variant="blue" icon={Icon.arrow} onClick={onReRun} />
          </div>
        }
      >
        <Wordmark onClick={onWordmark} />
        <div style={{ marginTop: 14 }}>
          <p className="kicker quiet" style={{ margin: '0 0 6px' }}>
            {c.banked.kickerUp}
          </p>
          <h1 className="h">
            {c.banked.hPartialLead}
            <em className="go">{p.kept}</em>
            {c.banked.hPartialTail}
          </h1>
        </div>
        <div style={{ marginTop: 16 }}>
          <WeekDots marks={marks} size={18} />
        </div>
        <div style={{ marginTop: 18 }}>
          <Money variant="neutral" label={c.banked.moneyLbl} amount={Number(fmt(p.retained))} note={c.banked.partialNote(p.kept, p.total)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Ledger
            tone="neutral"
            rows={[
              { k: c.banked.rowKept(p.kept), v: fmt(p.retained) },
              { k: c.banked.rowBurned(p.total - p.kept), v: `−${fmt(p.forfeited)}`, cls: 'burn' },
              { k: c.banked.rowBack, v: `${fmt(p.retained)} NIM`, cls: 'tot' },
            ]}
          />
        </div>
        <p className="sub" style={{ textAlign: 'center', margin: '13px auto 0', maxWidth: '33ch' }}>
          {c.banked.partialFwdLead}
          <b>{c.banked.partialFwdBold}</b>
          {c.banked.partialFwdTail}
        </p>
      </Frame>
    )
  }

  // wipeout
  return (
    <Frame
      foot={
        <div className="rs-foot-stack">
          <button className="ghost" onClick={onHome}>
            {c.banked.backHome}
          </button>
          <Cta label={c.banked.tryAgain} variant="blue" icon={Icon.arrow} onClick={onReRun} />
        </div>
      }
    >
      <Wordmark onClick={onWordmark} />
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
        <div style={{ marginTop: 26, width: '100%' }}>
          <Money variant="quiet" label={c.banked.burnedLbl} amount={p.stake} note={c.banked.wipeoutNote} />
        </div>
        <p className="sub" style={{ marginTop: 20, maxWidth: '30ch' }}>
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
          <span className="recgoal">
            {challenge.emoji} {label}
          </span>
          <span className="recnum">{c.reup.recordNum(record)}</span>
        </div>
        <div className="field">
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className="fd" />
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
    <Frame foot={<Cta label={c.archive.start} variant="green" icon={Icon.arrow} onClick={onStart} />}>
      <Wordmark onClick={onWordmark} />
      <h1 className="h" style={{ marginTop: 14 }}>
        {c.archive.h}
      </h1>
      <p className="sub" style={{ margin: '3px 0 0' }}>
        {c.archive.lead}
      </p>
      <div className="list">
        {history.map((h) => {
          const tag = TAG[h.outcome]
          const meta = h.outcome === 'lapsed' ? c.archive.metaLapsed : c.archive.meta(h.kept, h.total, h.stake, whenLabel(h.endedAt))
          return (
            <button key={h.id} className="row" onClick={() => onRow(h.templateId)}>
              <span className="av">{h.emoji}</span>
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
  const label = labelOf(challenge)
  const wv = weekView(challenge)
  const slice = challenge.stake / challenge.durationDays
  const kept = keptDays(challenge).size
  const [hintOpen, setHintOpen] = useState(true)
  return (
    <Frame
      sphere={
        <>
          {hintOpen && (
            <PopOver variant="hint" onClose={() => setHintOpen(false)}>
              <p className="hintline">
                {c.missed.hintPre}
                <em>{c.missed.hintEm}</em>
                {c.missed.hintPost}
              </p>
            </PopOver>
          )}
          <Sphere onClick={() => setHintOpen(true)} motion={hintOpen ? 'lively' : 'calm'} />
        </>
      }
      foot={<Cta label={c.missed.cta} variant="green" icon={Icon.arrow} onClick={onWinToday} />}
    >
      <Wordmark onClick={onWordmark} />
      <div className="goal" style={{ marginTop: 22 }}>
        {challenge.emoji} {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <HeroDot state="missed" fill={0.9} size={132} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 26 }}>
        <h1 className="h" style={{ textAlign: 'center' }}>
          {c.missed.hLead}
          <span className="fs">.</span>
        </h1>
        <p className="sub" style={{ margin: '10px auto 0', maxWidth: '32ch', textAlign: 'center' }}>
          {c.missed.sub(Number(fmt(slice)), kept)}
        </p>
      </div>
      <div style={{ marginTop: 26 }}>
        <WeekFrame marks={wv.marks} />
      </div>
    </Frame>
  )
}

// ============================================================================
// ⓼ Lapsed — the taste's 24h passed without a commit (no shame, restartable)
// ============================================================================
export function LapsedScreen({ challenge, onStartAgain, onWordmark }: { challenge: Challenge; onStartAgain: () => void; onWordmark: () => void }) {
  return (
    <Frame foot={<Cta label={c.lapsed.cta} variant="blue" icon={Icon.arrow} onClick={onStartAgain} />}>
      <Wordmark onClick={onWordmark} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 56 }}>
        <HeroDot state="faded" size={132} emoji={challenge.emoji} />
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

// ============================================================================
// ⓺ Perfect week — the milestone celebration (no bonus pill, §12.7)
// ============================================================================
export function PerfectWeekScreen({ onShare, onWordmark }: { onShare: () => void; onWordmark: () => void }) {
  return (
    <Frame
      sphere={<Sphere onClick={() => {}} />}
      foot={<Cta label={c.perfectweek.cta} variant="green" icon={Icon.share} onClick={onShare} />}
    >
      <Wordmark onClick={onWordmark} />
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <p className="kicker go" style={{ margin: '0 0 8px' }}>
          {c.perfectweek.kicker}
        </p>
        <h1 className="h">
          {c.perfectweek.hLead}
          <em>{c.perfectweek.hEm}</em>
          <span className="fs">.</span>
        </h1>
      </div>
      <div style={{ marginTop: 26 }}>
        <PerfectRing />
      </div>
      <p className="sub" style={{ margin: '30px auto 0', maxWidth: '30ch', textAlign: 'center' }}>
        {c.perfectweek.sub}
      </p>
    </Frame>
  )
}
