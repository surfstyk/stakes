import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
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
  const g = copy.gate

  useEffect(() => {
    if (!challengeId) return
    let alive = true
    // Same-origin /api works from a plain browser too, so we can show the invite preview
    // before the user crosses over into Nimiq Pay.
    getChallenge(challengeId).then((r) => {
      if (alive) setRec(r)
    })
    return () => {
      alive = false
    }
  }, [challengeId])

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

      {rec ? (
        <>
          <p className="s-kicker" style={{ marginTop: 20 }}>
            {g.invitedKicker(rec.creatorName)}
          </p>
          {/* compact pledge preview — mirrors JoinScreen's PledgeMini so the invitee sees
              exactly what they're being pulled into before crossing into Nimiq Pay */}
          <div className="pledge" style={{ padding: '20px 22px', margin: '6px auto 0', maxWidth: 360 }}>
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

      <div className="s-spacer" />
      <button className="s-cta" data-variant="go" onClick={() => openInNimiqPay()}>
        {g.open}
      </button>
      <div style={{ height: 10 }} />
      <a
        className="s-ghost"
        href={NIMIQ_PAY_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        {g.get}
      </a>
      <p className="s-foothint" style={{ marginTop: 14 }}>
        {g.foot}
      </p>
    </motion.div>
  )
}
