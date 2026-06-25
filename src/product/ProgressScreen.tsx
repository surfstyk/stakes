import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { copy } from '../brand/index.ts'
import {
  avatarColor,
  checkIn,
  cheer,
  daysCompletedFor,
  getChallenge,
  getCheckinPhoto,
  getMe,
  initials,
  seedMockActivity,
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
  const me = getMe()
  const [rec, setRec] = useState<ChallengeRecord | null>(() => getChallenge(challengeId))
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<string | undefined>(undefined)
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    seedMockActivity(challengeId)
    setRec(getChallenge(challengeId))
  }, [challengeId])

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

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(f)
  }

  function submit() {
    if (!note.trim() && !photo) return
    const updated = checkIn(challengeId, { account: me, day: myDays, note: note.trim(), emoji: mood, photo })
    setRec({ ...updated })
    setNote('')
    setMood(undefined)
    setPhoto(undefined)
    if (fileRef.current) fileRef.current.value = ''
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
            <button className="mood photo" onClick={() => fileRef.current?.click()}>
              {photo ? '🖼️' : '📷'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          </div>
          {photo && <img className="composer-photo" src={photo} alt="check-in" />}
          <button
            className="s-cta"
            data-variant="go"
            style={{ marginTop: 12 }}
            disabled={!note.trim() && !photo}
            onClick={submit}
          >
            {copy.progress.checkinCta(myDays + 1)}
          </button>
        </div>
      )}

      <p className="s-label">{copy.progress.crewLabel}</p>
      <ul className="feed">
        {feed.map((c) => (
          <FeedItem key={c.id} c={c} onCheer={() => setRec({ ...cheer(challengeId, c.id) })} />
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

function FeedItem({ c, onCheer }: { c: CheckIn; onCheer: () => void }) {
  const photo = getCheckinPhoto(c.id)
  return (
    <li className="feed-item">
      <span
        className="s-av"
        style={{ background: avatarColor(c.account), width: 36, height: 36, marginLeft: 0 }}
      >
        {initials(c.account)}
      </span>
      <div className="feed-body">
        <div className="feed-head">
          <strong>{c.account}</strong>
          <span className="feed-day">{copy.progress.feedDay(c.day + 1)}</span>
        </div>
        <div className="feed-note">
          {c.emoji ? `${c.emoji} ` : ''}
          {c.note}
        </div>
        {photo && <img className="feed-photo" src={photo} alt="" />}
      </div>
      <button className="cheer" onClick={onCheer}>
        🔥 {c.cheers}
      </button>
    </li>
  )
}
