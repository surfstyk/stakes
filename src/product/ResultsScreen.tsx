import { useMemo } from 'react'
import { copy } from '../brand/index.ts'
import { Confetti } from './Confetti.tsx'
import { Headline } from './Headline.tsx'
import { ShareComposer } from '../share/index.ts'
import type { ResultsCardData } from '../share/index.ts'
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
          <BoardRow key={r.account} r={r} D={rec.durationDays} asset={rec.asset} me={me} />
        ))}
      </ul>

      <div className="s-card s-center" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800 }}>{copy.results.burnedSummary(fmt(settlement.burnedPot), rec.asset)}</div>
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
          {r.account === me ? copy.results.you : r.account}{' '}
          {r.isPerfectFinisher && <span title={copy.results.perfectBadgeTitle}>🏅</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {copy.results.daysMeta(r.daysCompleted, D)}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {fmt(r.payout)} {asset}
        </div>
        {r.forfeited > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--stake)' }}>{copy.results.burnedTag(fmt(r.forfeited))}</div>
        )}
      </div>
    </li>
  )
}
