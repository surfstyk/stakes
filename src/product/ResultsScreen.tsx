import { useEffect, useMemo, useState } from 'react'
import { copy } from '../brand/index.ts'
import { Confetti } from './Confetti.tsx'
import { Headline } from './Headline.tsx'
import { Loading } from './Loading.tsx'
import { ShareComposer, fmtAmount } from '../share/index.ts'
import type { ResultsCardData } from '../share/index.ts'
import { computeSettlement, type ParticipantPayout } from '../vault/settlement.ts'
import { avatarColor, buildResults, getChallenge, getMyAddress, initials, nameFor, type ChallengeRecord } from './store.ts'

const NIM_BONUS = 10 // sponsor/treasury-funded completion bonus (matches the backend)

export function ResultsScreen({
  challengeId,
  onHome,
}: {
  challengeId: string
  onHome: () => void
}) {
  const [rec, setRec] = useState<ChallengeRecord | null>(null)
  const [me, setMe] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([getChallenge(challengeId), getMyAddress()]).then(([view, addr]) => {
      if (!alive) return
      setRec(view)
      setMe(addr)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [challengeId])

  // Settlement is computed client-side from the fetched view via the same deterministic
  // `computeSettlement` the backend uses — identical math, no extra round trip.
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

  if (loading) return <Loading />

  if (!rec || !settlement) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <h1 className="s-h1">{copy.results.none}</h1>
        <button className="s-cta" onClick={onHome}>
          {copy.results.home}
        </button>
      </div>
    )
  }

  const rows = [...settlement.perParticipant].sort(
    (a, b) => b.daysCompleted - a.daysCompleted || b.payout - a.payout,
  )
  const mine = settlement.perParticipant.find((p) => p.account === me)
  const finishers = rows.filter((r) => r.isPerfectFinisher)

  const cardData: ResultsCardData | null = mine
    ? {
        kind: 'results',
        id: rec.id,
        createdAt: rec.createdAt,
        emoji: rec.emoji,
        goal: rec.goal,
        durationDays: rec.durationDays,
        daysCompleted: mine.daysCompleted,
        payout: mine.payout,
        asset: rec.asset,
        isPerfectFinisher: mine.isPerfectFinisher,
        creatorName: rec.creatorName,
      }
    : null

  return (
    <div>
      {mine?.isPerfectFinisher && <Confetti />}
      <p className="s-kicker">{copy.results.kicker(rec.emoji, rec.goal)}</p>
      <Headline h={mine?.isPerfectFinisher ? copy.results.h1Perfect : copy.results.h1Landed} />

      {mine && cardData && (
        <ShareComposer
          data={cardData}
          cta={mine.isPerfectFinisher ? copy.results.shareWin : copy.results.shareWrap}
          shareText={
            mine.isPerfectFinisher
              ? copy.share.resultsWin(rec.emoji, rec.goal)
              : copy.share.resultsWrap(rec.emoji)
          }
          shareUrl={`${location.origin}${location.pathname}?c=${rec.id}`}
        />
      )}

      <p className="s-label">{copy.results.crewLabel}</p>
      <ul className="board">
        {rows.map((r) => (
          <BoardRow
            key={r.account}
            r={r}
            D={rec.durationDays}
            asset={rec.asset}
            name={nameFor(rec, r.account)}
            isMe={r.account === me}
          />
        ))}
      </ul>

      <div className="s-card s-center" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800 }}>{copy.results.burnedSummary(fmtAmount(settlement.burnedPot), rec.asset)}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
          {copy.results.burnedSub(finishers.length)}
        </div>
      </div>

      <div className="s-sticky">
        <button className="s-cta" data-variant="go" onClick={onHome}>
          {copy.results.runItBack}
        </button>
      </div>
    </div>
  )
}

function BoardRow({
  r,
  D,
  asset,
  name,
  isMe,
}: {
  r: ParticipantPayout
  D: number
  asset: string
  name: string
  isMe: boolean
}) {
  return (
    <li className="board-row">
      <span
        className="s-av"
        style={{ background: avatarColor(name), width: 34, height: 34, marginLeft: 0 }}
      >
        {initials(name)}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {isMe ? copy.results.you : name}{' '}
          {r.isPerfectFinisher && <span title={copy.results.perfectBadgeTitle}>🏅</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {copy.results.daysMeta(r.daysCompleted, D)}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {fmtAmount(r.payout)} {asset}
        </div>
        {r.forfeited > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--stake)' }}>{copy.results.burnedTag(fmtAmount(r.forfeited))}</div>
        )}
      </div>
    </li>
  )
}
