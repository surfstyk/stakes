import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import { Loading } from './Loading.tsx'
import {
  avatarColor,
  checkIn,
  cheer,
  daysCompletedFor,
  getChallenge,
  getMyAddress,
  initials,
  nameFor,
  type ChallengeRecord,
  type CheckIn,
} from './store.ts'

const MOODS = ['💪', '🔥', '😮‍💨', '😌', '🙌']

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

  if (loading) return <Loading />

  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }}>
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
  const myDays = daysCompletedFor(rec, me)
  const done = myDays >= D
  const feed = [...rec.checkins].sort((a, b) => b.at - a.at)

  async function submit() {
    if (posting || !rec) return
    if (!note.trim() && !mood) return
    setPosting(true)
    try {
      const updated = await checkIn(challengeId, { address: me, day: myDays, note: note.trim(), emoji: mood })
      setRec(updated)
      setNote('')
      setMood(undefined)
    } finally {
      setPosting(false)
    }
  }

  // Optimistic cheer: bump the count locally, fire the write in the background.
  function onCheer(checkinId: string) {
    setRec((prev) =>
      prev
        ? { ...prev, checkins: prev.checkins.map((c) => (c.id === checkinId ? { ...c, cheers: c.cheers + 1 } : c)) }
        : prev,
    )
    cheer(challengeId, checkinId).catch((e) => console.warn('cheer failed', e))
  }

  return (
    <div>
      <p className="s-kicker">{copy.progress.dayOf(Math.min(myDays + (done ? 0 : 1), D), D)}</p>
      <h1 className="s-h1">
        {rec.emoji} {rec.goal}
      </h1>

      <div className="streak">
        {Array.from({ length: D }).map((_, i) => {
          const state = i < myDays ? 'done' : i === myDays && !done ? 'today' : 'todo'
          return (
            <span key={i} className={`cell ${state}`}>
              {state === 'done' ? '✓' : i + 1}
            </span>
          )
        })}
      </div>

      {done ? (
        <div className="s-card s-center" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 28 }}>🏁</div>
          <p style={{ fontWeight: 800, margin: '6px 0 2px' }}>{copy.progress.doneTitle}</p>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>{copy.progress.doneSub}</p>
        </div>
      ) : (
        <div className="composer">
          <p className="s-label" style={{ margin: '16px 0 8px' }}>
            {copy.progress.checkinLabel}
          </p>
          <textarea
            className="s-field"
            rows={2}
            placeholder={copy.progress.checkinPlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
          />
          <div className="moods">
            {MOODS.map((m) => (
              <button key={m} className="mood" data-on={m === mood} onClick={() => setMood(m === mood ? undefined : m)}>
                {m}
              </button>
            ))}
          </div>
          <button
            className="s-cta"
            data-variant="go"
            style={{ marginTop: 12 }}
            disabled={posting || (!note.trim() && !mood)}
            onClick={submit}
          >
            {posting ? copy.progress.checkinBusy : copy.progress.checkinCta(myDays + 1)}
          </button>
        </div>
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

      <div className="s-sticky">
        <button className="s-cta" onClick={() => onResults(challengeId)}>
          {done ? copy.progress.seeResults : copy.progress.finishResults}
        </button>
      </div>
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
