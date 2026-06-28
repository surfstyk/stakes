import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { Loading } from './Loading.tsx'
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
  if (names.length === 1) return copy.join.whosInOne(names[0])
  if (names.length === 2) return copy.join.whosInTwo(names[0], names[1])
  return copy.join.whosInMany(names[0], names[1], names.length - 2)
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
  const [rec, setRec] = useState<ChallengeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const countdown = useCountdown(rec?.lockAt ?? 0)

  useEffect(() => {
    let alive = true
    getChallenge(challengeId).then((r) => {
      if (!alive) return
      setRec(r)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [challengeId])

  if (loading) return <Loading />

  // ---- challenge not found ----
  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }}>
          🤷
        </div>
        <h1 className="s-h1">{copy.join.notFoundH1}</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {copy.join.notFoundSub}
        </p>
        <button className="s-cta" onClick={onCreateOwn}>
          {copy.join.notFoundCta}
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
          {copy.join.joinedKicker}
        </p>
        <h1 className="s-h1">{copy.join.joinedH1}</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {copy.join.joinedSub(rec.stake, rec.asset, whosInLine(names))}
        </p>
        <button
          className="s-cta"
          onClick={async () => {
            const url = `${location.origin}${location.pathname}?c=${rec.id}`
            const text = copy.share.joined(rec.creatorName, rec.emoji)
            if (navigator.share) {
              try {
                await navigator.share({ title: brand.name, text, url })
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
          {copy.join.pullFriend}
        </button>
        <div className="s-spacer" />
        <button className="s-ghost" onClick={() => onEnter(rec.id)}>
          {copy.join.goChallenge}
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
        <h1 className="s-h1">{copy.join.closedH1}</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {copy.join.closedSub(rec.creatorName, rec.emoji)}
        </p>
        <button className="s-cta" onClick={onCreateOwn}>
          {copy.join.closedCta}
        </button>
        <div className="s-spacer" />
        <p className="s-foothint">{copy.join.closedFoot(whosInLine(names))}</p>
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
      <p className="s-kicker">{copy.join.kickerDared(rec.creatorName)}</p>
      <Headline h={copy.join.h1} />

      <div className="s-spacer" />
      <PledgeMini rec={rec} />

      <div className="s-card" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatars names={names} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{whosInLine(names)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {copy.join.stakingLine(names.length, rec.stake, rec.asset)}
          </div>
        </div>
      </div>

      <div className="s-spacer" />
      <div className="s-count">
        <span className="pulse" />
        {copy.join.countdown}&nbsp;<span className="nums">{countdown.text}</span>
      </div>

      <p className="s-label">{copy.join.nameLabel}</p>
      <input
        className="s-field"
        placeholder={copy.join.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={18}
      />

      <div className="s-sticky">
        <button className="s-cta" data-variant="go" disabled={busy} onClick={join}>
          {busy ? copy.join.ctaBusy : copy.join.cta(rec.stake, rec.asset)}
        </button>
        <p className="s-foothint">{copy.join.foothint}</p>
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
        <em>{rec.goal}</em> {copy.cards.pledgeForDays(rec.durationDays)}
      </h2>
      <div className="pledge-stake">
        <span className="amt">
          {rec.stake} {rec.asset}
        </span>{' '}
        <span className="lbl">{copy.join.miniToPlay}</span>
      </div>
    </div>
  )
}
