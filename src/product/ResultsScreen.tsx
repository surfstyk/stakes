import { useMemo } from 'react'
import { motion } from 'motion/react'
import { computeSettlement, type ParticipantPayout } from '../vault/settlement.ts'
import { avatarColor, buildResults, getChallenge, getMe, initials } from './store.ts'

const NIM_BONUS = 10 // sponsor/treasury-funded completion bonus (demo value)

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export function ResultsScreen({
  challengeId,
  onHome,
}: {
  challengeId: string
  onHome: () => void
}) {
  const rec = getChallenge(challengeId)
  const me = getMe()
  const settlement = useMemo(
    () =>
      rec
        ? computeSettlement({
            stake: rec.stake,
            durationDays: rec.durationDays,
            results: buildResults(rec),
            nimBonusPerFinisher: NIM_BONUS,
          })
        : null,
    [rec],
  )

  if (!rec || !settlement) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <h1 className="s-h1">No results yet.</h1>
        <button className="s-cta" onClick={onHome}>
          Home
        </button>
      </div>
    )
  }

  const rows = [...settlement.perParticipant].sort(
    (a, b) => b.daysCompleted - a.daysCompleted || b.payout - a.payout,
  )
  const mine = settlement.perParticipant.find((p) => p.account === me)
  const finishers = rows.filter((r) => r.isPerfectFinisher)

  async function share() {
    const url = `${location.origin}${location.pathname}?c=${rec!.id}`
    const text = mine?.isPerfectFinisher
      ? `Perfect week ✅ ${rec!.emoji} ${rec!.goal}. Run it back?`
      : `Wrapped my ${rec!.emoji} week on Stakes.`
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
  }

  return (
    <div>
      <p className="s-kicker">
        {rec.emoji} {rec.goal} · the week's up
      </p>
      <h1 className="s-h1">
        {mine?.isPerfectFinisher ? (
          <>
            Perfect <em>week.</em>
          </>
        ) : (
          <>
            How it <em>landed.</em>
          </>
        )}
      </h1>

      {mine && (
        <motion.div
          className="result-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <div className="rc-top">
            <span className="brand">Stakes</span>
            <span className="meta">
              {mine.daysCompleted}/{rec.durationDays} days
            </span>
          </div>
          <div className="rc-big">
            {fmt(mine.payout)} <span>{rec.asset} back</span>
          </div>
          <div className="rc-rows">
            {mine.forfeited > 0 && (
              <div>
                <span>🔥 burned</span>
                <b>
                  {fmt(mine.forfeited)} {rec.asset}
                </b>
              </div>
            )}
            {mine.isPerfectFinisher && (
              <div className="go">
                <span>🎉 finisher bonus</span>
                <b>+{fmt(mine.nimBonus)} NIM</b>
              </div>
            )}
            {mine.isPerfectFinisher && (
              <div className="go">
                <span>🏅 perfect-week club</span>
                <b>joined</b>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="s-spacer" />
      <button className="s-cta" onClick={share}>
        {mine?.isPerfectFinisher ? 'Share the win' : 'Share the wrap'}
      </button>

      <p className="s-label">The crew</p>
      <ul className="board">
        {rows.map((r) => (
          <BoardRow key={r.account} r={r} D={rec.durationDays} asset={rec.asset} me={me} />
        ))}
      </ul>

      <div className="s-card s-center" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800 }}>
          🔥 {fmt(settlement.burnedPot)} {rec.asset} burned
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
          Removed from circulation. {finishers.length} in the perfect-week club.
        </div>
      </div>

      <div className="s-sticky">
        <button className="s-cta" data-variant="go" onClick={onHome}>
          Run it back →
        </button>
      </div>
    </div>
  )
}

function BoardRow({
  r,
  D,
  asset,
  me,
}: {
  r: ParticipantPayout
  D: number
  asset: string
  me: string
}) {
  return (
    <li className="board-row">
      <span
        className="s-av"
        style={{ background: avatarColor(r.account), width: 34, height: 34, marginLeft: 0 }}
      >
        {initials(r.account)}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {r.account === me ? 'You' : r.account} {r.isPerfectFinisher && <span title="perfect week">🏅</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {r.daysCompleted}/{D} days
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {fmt(r.payout)} {asset}
        </div>
        {r.forfeited > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--stake)' }}>−{fmt(r.forfeited)} burned</div>
        )}
      </div>
    </li>
  )
}
