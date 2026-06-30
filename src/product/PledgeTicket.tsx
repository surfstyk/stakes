import { copy } from '../brand/index.ts'
import type { ChallengeRecord } from './store.ts'

// The pledge as a tactile DOM "ticket" — the in-app sibling of the canvas share card.
// Same visual language (paper, inset ink frame, vermilion rubber stamp, dashed
// perforation, signed/sealed footer) but a wide in-app format, not the 9:16 story
// export. Used on the Join screen; reusable for the gate preview. The shareable PNG is
// still the canvas CardStyle (src/share) — this is the live, on-screen artifact.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Stable 4-digit "ticket number" from a challenge id (cosmetic). */
function ticketNo(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return `No. ${String((h % 9000) + 1000)}`
}

/** "Jun 29 ’26" */
function sealedDate(ms: number): string {
  const d = new Date(ms)
  return `${MON[d.getMonth()]} ${d.getDate()} ’${String(d.getFullYear()).slice(-2)}`
}

export function PledgeTicket({ rec }: { rec: ChallengeRecord }) {
  const c = copy.cards
  return (
    <div className="ticket-wrap">
      <article className="ticket" aria-label="Pledge ticket">
        <div className="frame" aria-hidden="true" />

        {/* rubber-ink stamp — thumps down on entry */}
        <div className="stamp" aria-hidden="true">
          <span className="s-main">{c.pledgeStamp}</span>
          <span className="s-sub">· {c.pledgeStampSub} ·</span>
        </div>

        <div className="ticket-inner">
          <div className="ticket-top">
            <div className="ticket-brand">
              <span className="dot" />
              {c.brand}
            </div>
            <div className="ticket-no">{ticketNo(rec.id)}</div>
          </div>

          <div className="ticket-emoji">{rec.emoji}</div>
          <div className="ticket-goal">{rec.goal}</div>
          <div className="ticket-for">{c.pledgeForDays(rec.durationDays)}</div>

          <div className="ticket-stake">
            <span className="amt">
              {rec.stake} {rec.asset}
            </span>
            <span className="lbl">{c.pledgeOnLine}</span>
          </div>
        </div>

        {/* the tear: a clean dashed perforation rule */}
        <div className="tear-line" aria-hidden="true" />

        <div className="ticket-foot">
          <div className="ticket-cta">
            {c.ticketCta.lead}
            <em>{c.ticketCta.em}</em>
            {c.ticketCta.tail}
          </div>
          <div className="ticket-sign">
            <div>
              <div className="by">{c.ticketSignedBy}</div>
              <div className="name">{rec.creatorName}</div>
            </div>
            <div className="date">
              {c.ticketSealed}
              <br />
              {sealedDate(rec.createdAt)}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
