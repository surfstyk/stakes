import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { Loading } from './Loading.tsx'
import { PledgeTicket } from './PledgeTicket.tsx'
import { NIMIQ_PAY_INSTALL_URL, openInNimiqPay } from '../lib/context.ts'
import { getChallenge, type ChallengeRecord } from './store.ts'

// The "Open in Nimiq Pay" gate / smart landing.
//
// Shown by App when a real-money build is opened OUTSIDE Nimiq Pay (the invite-link trap:
// a shared https link tapped in a normal mobile browser). It NEVER lets a visitor silently
// mock-stake real money — instead it routes them into Nimiq Pay, where their real wallet
// and the real stake live, via the documented `nimiqpay://miniapp?url=…` deeplink that
// preserves the current URL (incl. ?c=<id>), so they land right back on the join screen.
//
// For an invite (?c=<id>) it fetches the challenge and shows the pledge preview + who's-in,
// keeping the social hook intact — the landing IS the pitch, not a dead-end wall.

export function OpenInNimiqPay({ challengeId }: { challengeId?: string }) {
  const [rec, setRec] = useState<ChallengeRecord | null>(null)
  const [loading, setLoading] = useState(!!challengeId)
  const [expired, setExpired] = useState(false)
  const g = copy.gate

  useEffect(() => {
    if (!challengeId) return
    let alive = true
    // Same-origin /api works from a plain browser too, so we can show the invite preview
    // before the user crosses over into Nimiq Pay.
    getChallenge(challengeId).then((r) => {
      if (!alive) return
      if (r) setRec(r)
      else setExpired(true) // link points at a challenge that's over / gone
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [challengeId])

  // Hold on a spinner while an invite is fetched, so we never flash the generic gate and
  // then snap to the invite preview (the layout shift the audit flagged).
  if (loading) return <Loading />

  // For an expired invite, cross over to a CLEAN url (no ?c=) so they land on Create and can
  // start their own — not back on the dead invite's "This one's gone".
  const cleanUrl = location.origin + location.pathname

  return (
    <motion.div
      className="s-center"
      style={{ paddingTop: 30 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="s-wordmark" style={{ justifyContent: 'center' }}>
        {brand.hasDot && <span className="dot" />} {brand.name}
      </span>

      {expired ? (
        <>
          <p className="s-kicker" style={{ marginTop: 20 }}>
            {g.expiredKicker}
          </p>
          <Headline h={g.expiredH1} className="s-h1" />
          <p className="s-sub" style={{ margin: '0 auto 6px' }}>
            {g.expiredSub}
          </p>
        </>
      ) : rec ? (
        <>
          <p className="s-kicker" style={{ marginTop: 20 }}>
            {g.invitedKicker(rec.creatorName)}
          </p>
          {/* the real pledge ticket — the same artifact they saw shared and will meet again
              on the Join screen, so the invitee sees exactly what they're crossing over for */}
          <div className="stage">
            <PledgeTicket rec={rec} />
          </div>
          <p className="s-sub" style={{ margin: '14px auto 6px' }}>
            {g.invitedSub}
          </p>
        </>
      ) : (
        <>
          <p className="s-kicker" style={{ marginTop: 20 }}>
            {g.kicker}
          </p>
          <Headline h={g.h1} className="s-h1" />
          <p className="s-sub" style={{ margin: '0 auto 6px' }}>
            {g.sub}
          </p>
        </>
      )}

      {/* reassurance — defuse the fear before the cross-over (no jargon) */}
      <div className="gate-trust">
        <ShieldCheck />
        {copy.join.guarantee}
      </div>
      <button
        className="s-cta s-cta--share"
        data-variant="go"
        onClick={() => openInNimiqPay(expired ? cleanUrl : undefined)}
      >
        {expired ? g.expiredOpen : g.open}
      </button>
      {/* gently pre-empt Nimiq Pay's first-access confirm + unlock so it doesn't feel broken */}
      <p className="gate-reassure">{g.reassure}</p>
      <a
        className="s-ghost"
        href={NIMIQ_PAY_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 12 }}
      >
        {g.get}
      </a>
      <p className="s-foothint" style={{ marginTop: 14 }}>
        {g.foot}
      </p>
    </motion.div>
  )
}

function ShieldCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 3v6c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V5l7-3z" stroke="var(--ink-soft)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 11.5l2 2 4-4.5" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
