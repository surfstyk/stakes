import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import { Loading } from './Loading.tsx'
import { ShareComposer, getStyle, type ProgressCardData } from '../share/index.ts'
import {
  avatarColor,
  checkIn,
  checkedDaysFor,
  cheer,
  dayMarks,
  dayState,
  getChallenge,
  getMyAddress,
  initials,
  nameFor,
  type ChallengeRecord,
  type CheckIn,
} from './store.ts'

const MOODS = ['💪', '🔥', '😮‍💨', '😌', '🙌']
// The daily progress card uses the single house "Pledge" style (the flippable variety
// lives at the big pledge/results moments; the mid-week share is one consistent artifact).
const PROGRESS_STYLES = [getStyle('ticket')]

/** Compact h/m/s countdown — minutes/seconds in test, hours/days in production. */
function fmtDur(ms: number): string {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function ProgressScreen({
  challengeId,
  onResults,
  onCreate,
}: {
  challengeId: string
  onResults: (id: string) => void
  onCreate: () => void
}) {
  const [me, setMe] = useState('')
  const [rec, setRec] = useState<ChallengeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<string | undefined>(undefined)
  const [posting, setPosting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    Promise.all([getMyAddress(), getChallenge(challengeId)]).then(([addr, view]) => {
      if (!alive) return
      setMe(addr)
      setRec(view)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [challengeId])

  // Live clock so day windows open/close and countdowns tick without a reload.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <Loading />

  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }} aria-hidden="true">
          🤷
        </div>
        <h1 className="s-h1">{copy.progress.notFoundH1}</h1>
        <button className="s-cta" onClick={onCreate}>
          {copy.progress.notFoundCta}
        </button>
      </div>
    )
  }

  const D = rec.durationDays
  const ds = dayState(rec, now)
  const checked = checkedDaysFor(rec, me)
  const marks = dayMarks(rec, me, now)
  const checkedToday = ds.started && !ds.over && checked.has(ds.currentDay)
  const canCheckIn = ds.started && !ds.over && !checkedToday
  const feed = [...rec.checkins].sort((a, b) => b.at - a.at)

  const shareUrl = `${location.origin}${location.pathname}?c=${rec.id}`
  const progressData: ProgressCardData | null =
    ds.started && !ds.over
      ? {
          kind: 'progress',
          id: rec.id,
          createdAt: rec.createdAt,
          emoji: rec.emoji,
          goal: rec.goal,
          durationDays: D,
          currentDay: ds.currentDay + 1,
          daysKept: checked.size,
          days: marks,
          stake: rec.stake,
          asset: rec.asset,
          creatorName: nameFor(rec, me),
        }
      : null

  async function submit() {
    if (posting || !rec || !canCheckIn) return
    if (!note.trim() && !mood) return
    setPosting(true)
    setErr(null)
    try {
      const updated = await checkIn(challengeId, { address: me, day: ds.currentDay, note: note.trim(), emoji: mood })
      setRec(updated)
      setNote('')
      setMood(undefined)
    } catch (e) {
      // Surface the failure instead of silently resetting (UX-02). The server's message is
      // user-facing (e.g. "only today's check-in is open" if the window closed mid-compose).
      setErr((e as Error).message || copy.progress.errFallback)
    } finally {
      setPosting(false)
    }
  }

  function onCheer(checkinId: string) {
    setRec((prev) =>
      prev
        ? { ...prev, checkins: prev.checkins.map((c) => (c.id === checkinId ? { ...c, cheers: c.cheers + 1 } : c)) }
        : prev,
    )
    cheer(challengeId, checkinId).catch((e) => console.warn('cheer failed', e))
  }

  const kicker = !ds.started
    ? copy.progress.startsKicker
    : ds.over
      ? copy.progress.wrappedKicker
      : copy.progress.dayOf(ds.currentDay + 1, D)

  return (
    <div>
      <p className="s-kicker">{kicker}</p>
      <h1 className="s-h1">
        {rec.emoji} {rec.goal}
      </h1>

      <div className="streak">
        {marks.map((state, i) => (
          <span key={i} className={`cell ${state}`}>
            {state === 'done' ? '✓' : state === 'missed' ? '✕' : i + 1}
          </span>
        ))}
      </div>

      {/* ---- the state-appropriate panel ---- */}
      {!ds.started ? (
        <div className="s-card s-center" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 28 }} aria-hidden="true">⏳</div>
          <p style={{ fontWeight: 800, margin: '6px 0 2px' }}>{copy.progress.startsTitle}</p>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>
            {copy.progress.startsSub(fmtDur(ds.msUntilStart))}
          </p>
        </div>
      ) : ds.over ? (
        <div className="s-card s-center" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 28 }} aria-hidden="true">🏁</div>
          <p style={{ fontWeight: 800, margin: '6px 0 2px' }}>{copy.progress.overTitle}</p>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>{copy.progress.overSub}</p>
        </div>
      ) : checkedToday ? (
        <div className="s-card s-center" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 28 }} aria-hidden="true">✅</div>
          <p style={{ fontWeight: 800, margin: '6px 0 2px' }}>{copy.progress.checkedTitle}</p>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>
            {copy.progress.checkedSub(fmtDur(ds.msLeftInDay))}
          </p>
        </div>
      ) : (
        <div className="composer">
          <label className="s-label" htmlFor="checkin-note" style={{ margin: '16px 0 4px' }}>
            {copy.progress.checkinLabel}
          </label>
          <p className="s-note" style={{ color: 'var(--stake)' }}>{copy.progress.windowLeft(fmtDur(ds.msLeftInDay))}</p>
          <textarea
            id="checkin-note"
            className="s-field"
            rows={2}
            placeholder={copy.progress.checkinPlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
          />
          <div className="moods" role="group" aria-label="Add a mood">
            {MOODS.map((m) => (
              <button
                key={m}
                className="mood"
                data-on={m === mood}
                aria-pressed={m === mood}
                onClick={() => setMood(m === mood ? undefined : m)}
              >
                {m}
              </button>
            ))}
          </div>
          {err && (
            <p className="s-note" role="alert" style={{ color: 'var(--stake)', marginTop: 10 }}>
              {err}
            </p>
          )}
          <button
            className="s-cta"
            data-variant="go"
            style={{ marginTop: 12 }}
            disabled={posting || (!note.trim() && !mood)}
            onClick={submit}
          >
            {posting ? copy.progress.checkinBusy : copy.progress.checkinCta(ds.currentDay + 1)}
          </button>
        </div>
      )}

      {checkedToday && progressData && (
        <>
          <p className="s-label">{copy.progress.shareLabel}</p>
          <ShareComposer
            styles={PROGRESS_STYLES}
            data={progressData}
            cta={copy.progress.shareCta}
            shareText={copy.share.progress(rec.emoji, rec.goal, ds.currentDay + 1, D)}
            shareUrl={shareUrl}
          />
        </>
      )}

      <p className="s-label">{copy.progress.crewLabel}</p>
      <ul className="feed">
        {feed.map((c) => (
          <FeedItem key={c.id} c={c} name={nameFor(rec, c.address)} onCheer={() => onCheer(c.id)} />
        ))}
        {feed.length === 0 && (
          <p className="s-foothint" style={{ textAlign: 'left' }}>
            {copy.progress.feedEmpty}
          </p>
        )}
      </ul>

      {/* Results are time-gated — you can't finish early. Only offer the results view
          once the challenge is actually over; during the run, checking in is the action. */}
      {ds.over && (
        <div className="s-sticky">
          <button className="s-cta" data-variant="go" onClick={() => onResults(challengeId)}>
            {copy.progress.seeResults}
          </button>
        </div>
      )}
    </div>
  )
}

function FeedItem({ c, name, onCheer }: { c: CheckIn; name: string; onCheer: () => void }) {
  return (
    <li className="feed-item">
      <span
        className="s-av"
        style={{ background: avatarColor(name), width: 36, height: 36, marginLeft: 0 }}
      >
        {initials(name)}
      </span>
      <div className="feed-body">
        <div className="feed-head">
          <strong>{name}</strong>
          <span className="feed-day">{copy.progress.feedDay(c.day + 1)}</span>
        </div>
        <div className="feed-note">
          {c.emoji ? `${c.emoji} ` : ''}
          {c.note}
        </div>
      </div>
      <button className="cheer" onClick={onCheer}>
        🔥 {c.cheers}
      </button>
    </li>
  )
}
