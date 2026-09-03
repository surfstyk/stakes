import { motion } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { NIMIQ_PAY_INSTALL_URL, openInNimiqPay } from '../lib/context.ts'

// The "Open in Nimiq Pay" gate.
//
// Shown by App when a real-money build is opened OUTSIDE Nimiq Pay (the invite-link trap:
// a shared https link tapped in a normal mobile browser). It NEVER lets a visitor silently
// mock-stake real money — instead it routes them into Nimiq Pay, where their real wallet
// and the real stake live, via the documented `nimiqpay://miniapp?url=…` deeplink that
// preserves the current URL, so they land right back where they were. The solo journey has
// no join/invite preview, so the gate is a single clean cross-over, not a social pitch.

export function OpenInNimiqPay() {
  const g = copy.gate
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

      <p className="s-kicker" style={{ marginTop: 20 }}>
        {g.kicker}
      </p>
      <Headline h={g.h1} className="s-h1" />
      <p className="s-sub" style={{ margin: '0 auto 6px' }}>
        {g.sub}
      </p>

      {/* reassurance — defuse the fear before the cross-over (no jargon) */}
      <div className="gate-trust">
        <ShieldCheck />
        {g.guarantee}
      </div>
      <button className="s-cta s-cta--share" data-variant="go" onClick={() => openInNimiqPay()}>
        {g.open}
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
