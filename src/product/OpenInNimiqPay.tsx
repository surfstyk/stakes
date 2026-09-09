import { copy } from '../brand/index.ts'
import { Cta, Frame, Icon, Wordmark } from '../reshape/ui.tsx'
import { NIMIQ_PAY_INSTALL_URL, openInNimiqPay } from '../lib/context.ts'

// The "Open in Nimiq Pay" gate.
//
// Shown by App when a real-money build is opened OUTSIDE Nimiq Pay (the invite-link trap:
// a shared https link tapped in a normal browser). It NEVER lets a visitor silently mock-stake
// real money — instead it routes them into Nimiq Pay, where their real wallet and the real stake
// live, via the App Link (see lib/context.ts nimiqPayDeeplink) which preserves the current URL,
// so they land right back where they were. The solo journey has no join/invite preview, so the
// gate is a single clean cross-over, not a social pitch.
//
// Built on the reshape (.rs) design system — same wordmark, eyebrow, serif headline and CTA as
// the app behind it — and mounted inside the .rs frame by App, so a browser visitor meets the
// same product they are about to step into.
export function OpenInNimiqPay() {
  const g = copy.gate
  return (
    <Frame
      foot={
        <div className="rs-foot-stack">
          <Cta label={g.open} variant="blue" icon={Icon.arrow} onClick={() => openInNimiqPay()} />
          <a className="ghost" href={NIMIQ_PAY_INSTALL_URL} target="_blank" rel="noopener noreferrer">
            {g.get}
          </a>
          {/* gently pre-empt Nimiq Pay's first-access confirm + unlock so it doesn't feel broken */}
          <p className="gate-note">{g.reassure}</p>
        </div>
      }
    >
      <Wordmark />
      <div className="gate-body">
        <p className="kicker">{g.kicker}</p>
        <h1 className="h" style={{ marginTop: 8 }}>
          {g.h1.lead}
          <em>{g.h1.em}</em>
          <span className="fs">.</span>
        </h1>
        <p className="sub" style={{ marginTop: 12, maxWidth: '30ch' }}>
          {g.sub}
        </p>
        {/* reassurance — defuse the money fear before the cross-over (no jargon) */}
        <p className="gate-trust">
          <ShieldCheck />
          {g.guarantee}
        </p>
        <p className="gate-foot">{g.foot}</p>
      </div>
    </Frame>
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
