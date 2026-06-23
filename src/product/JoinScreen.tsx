import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  avatarColor,
  getChallenge,
  initials,
  joinChallenge,
  type ChallengeRecord,
} from './store.ts'

function useCountdown(target: number): { text: string; over: boolean } {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = target - now
  if (ms <= 0) return { text: '0h 0m 0s', over: true }
  const h = Math.floor(ms / 3600_000)
  const m = Math.floor((ms % 3600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return { text: `${h}h ${m}m ${s}s`, over: false }
}

function Avatars({ names }: { names: string[] }) {
  const shown = names.slice(0, 4)
  const extra = names.length - shown.length
  return (
    <div className="s-avatars">
      {shown.map((n, i) => (
        <span key={i} className="s-av" style={{ background: avatarColor(n) }}>
          {initials(n)}
        </span>
      ))}
      {extra > 0 && <span className="s-av more">+{extra}</span>}
    </div>
  )
}

function whosInLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} is in`
  if (names.length === 2) return `${names[0]} & ${names[1]} are in`
  return `${names[0]}, ${names[1]} +${names.length - 2} are in`
}

export function JoinScreen({
  challengeId,
  onCreateOwn,
  onEnter,
}: {
  challengeId: string
  onCreateOwn: () => void
  onEnter: (id: string) => void
}) {
  const [rec, setRec] = useState<ChallengeRecord | null>(() => getChallenge(challengeId))
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const countdown = useCountdown(rec?.lockAt ?? 0)

  // ---- challenge not found ----
  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }}>
          🤷
        </div>
        <h1 className="s-h1">This one's gone.</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          The link's expired or the challenge doesn't exist. Start your own — it takes 30 seconds.
        </p>
        <button className="s-cta" onClick={onCreateOwn}>
          Start a challenge
        </button>
      </div>
    )
  }

  const names = rec.participants.map((p) => p.name)

  // ---- joined confirmation ----
  if (joined) {
    return (
      <div className="s-confirm">
        <motion.div
          className="s-seal"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 14 }}
        >
          🤝
        </motion.div>
        <p className="s-kicker" style={{ color: 'var(--go)' }}>
          You're in
        </p>
        <h1 className="s-h1">See you Monday.</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {rec.stake} {rec.asset} locked. {whosInLine(names)}. Now drag a friend in — the more
          people watching, the harder it is to quit.
        </p>
        <button
          className="s-cta"
          onClick={async () => {
            const url = `${location.origin}${location.pathname}?c=${rec.id}`
            const text = `I just joined ${rec.creatorName}'s ${rec.emoji} challenge. You in?`
            if (navigator.share) {
              try {
                await navigator.share({ title: 'Stakes', text, url })
                return
              } catch {
                /* fall through */
              }
            }
            try {
              await navigator.clipboard.writeText(url)
            } catch {
              /* ignore */
            }
          }}
        >
          Pull in a friend
        </button>
        <div className="s-spacer" />
        <button className="s-ghost" onClick={() => onEnter(rec.id)}>
          Go to the challenge →
        </button>
      </div>
    )
  }

  // ---- doors closed (never dead-end) ----
  if (countdown.over) {
    return (
      <div className="s-center" style={{ paddingTop: 28 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }}>
          🚪
        </div>
        <h1 className="s-h1">Doors closed on this one.</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {rec.creatorName}'s {rec.emoji} week already kicked off. But you don't have to miss out.
        </p>
        <button className="s-cta" onClick={onCreateOwn}>
          Start the same challenge
        </button>
        <div className="s-spacer" />
        <p className="s-foothint">{whosInLine(names)} on the last one.</p>
      </div>
    )
  }

  // ---- join offer ----
  async function join() {
    setBusy(true)
    try {
      const updated = await joinChallenge(rec!.id, name.trim() || 'You')
      setRec(updated)
      setJoined(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="s-kicker">{rec.creatorName} dared you in</p>
      <h1 className="s-h1">
        Are you <em>in?</em>
      </h1>

      <div className="s-spacer" />
      <PledgeMini rec={rec} />

      <div className="s-card" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatars names={names} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{whosInLine(names)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {names.length} {names.length === 1 ? 'person' : 'people'} staking {rec.stake} {rec.asset}
          </div>
        </div>
      </div>

      <div className="s-spacer" />
      <div className="s-count">
        <span className="pulse" />
        Doors close in&nbsp;<span className="nums">{countdown.text}</span>
      </div>

      <p className="s-label">Join as</p>
      <input
        className="s-field"
        placeholder="your first name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={18}
      />

      <div className="s-sticky">
        <button className="s-cta" data-variant="go" disabled={busy} onClick={join}>
          {busy ? 'Locking it in…' : `Stake ${rec.stake} ${rec.asset} & join`}
        </button>
        <p className="s-foothint">You get it all back if you finish the week.</p>
      </div>
    </motion.div>
  )
}

// compact pledge summary for the join screen
function PledgeMini({ rec }: { rec: ChallengeRecord }) {
  return (
    <div className="pledge" style={{ padding: '20px 22px' }}>
      <div className="pledge-emoji" style={{ marginTop: 0, fontSize: 34 }}>
        {rec.emoji}
      </div>
      <h2 className="pledge-goal" style={{ fontSize: 24 }}>
        <em>{rec.goal}</em> for {rec.durationDays} days.
      </h2>
      <div className="pledge-stake">
        <span className="amt">
          {rec.stake} {rec.asset}
        </span>{' '}
        <span className="lbl">to play</span>
      </div>
    </div>
  )
}
