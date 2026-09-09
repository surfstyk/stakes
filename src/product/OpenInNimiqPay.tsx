import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import { Cta, Frame, Icon, Wordmark } from '../reshape/ui.tsx'
import { DEV_TOOLS } from '../lib/flags.ts'
import { NIMIQ_PAY_INSTALL_URL, nimiqPayDeeplink, openInNimiqPay } from '../lib/context.ts'

// The "Open in Nimiq Pay" gate.
//
// Shown by App when a real-money build is opened OUTSIDE Nimiq Pay (the invite-link trap:
// a shared https link tapped in a normal browser). It NEVER lets a visitor silently mock-stake
// real money — instead it carries them into Nimiq Pay, where their real wallet and the real stake
// live. Built on the reshape (.rs) design system and mounted inside the .rs frame by App, so a
// browser visitor meets the same product they are about to step into.
//
// Two variants, because Nimiq Pay is a phone app:
//  • TAP  — a device that can run Nimiq Pay (a touch pointer): one button → the App Link opens it.
//  • SCAN — a desktop (no touch pointer): the App Link can't open anything here, so instead of a
//           dead-end button we hand the visitor a QR that carries them onto their phone.
// ?gate=scan|tap forces a variant (dev builds only), for on-device + headless testing.
type GateVariant = 'scan' | 'tap'

function useGateVariant(): GateVariant {
  const [v] = useState<GateVariant>(() => {
    if (DEV_TOOLS) {
      const forced = new URLSearchParams(location.search).get('gate')
      if (forced === 'scan' || forced === 'tap') return forced
    }
    // No coarse (touch) pointer → a desktop that cannot run the mobile wallet → scan-to-phone.
    const noTouch = typeof matchMedia === 'function' && !matchMedia('(pointer: coarse)').matches
    return noTouch ? 'scan' : 'tap'
  })
  return v
}

export function OpenInNimiqPay() {
  const g = copy.gate
  const variant = useGateVariant()

  const head = (
    <>
      <p className="kicker" style={{ marginTop: 0 }}>
        {g.kicker}
      </p>
      <h1 className="h" style={{ marginTop: 8 }}>
        {g.h1.lead}
        <em>{g.h1.em}</em>
        <span className="fs">.</span>
      </h1>
    </>
  )

  if (variant === 'scan') {
    return (
      <Frame>
        <Wordmark />
        <div className="gate-body">
          {head}
          <p className="sub" style={{ marginTop: 12, maxWidth: '28ch' }}>
            {g.scanSub}
          </p>
          <QrPanel text={nimiqPayDeeplink()} />
          <p className="gate-scan-cap">{g.scanCap}</p>
          <a className="textlink gate-get" href={NIMIQ_PAY_INSTALL_URL} target="_blank" rel="noopener noreferrer">
            {g.get}
          </a>
        </div>
      </Frame>
    )
  }

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
        {head}
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

// The scan panel: a QR of the App Link (nimpay.app/miniapps/open/…) that opens the app in Nimiq
// Pay on the phone. The encoder is lazy-loaded so it never weighs on the mobile (tap) path.
function QrPanel({ text }: { text: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    import('qrcode-generator')
      .then((mod) => {
        // qrcode-generator uses `export =`, so the factory is the module itself (or .default
        // under esModuleInterop) — take whichever the bundler hands back.
        const qrcode = ((mod as { default?: unknown }).default ?? mod) as typeof import('qrcode-generator')
        const qr = qrcode(0, 'M')
        qr.addData(text)
        qr.make()
        return qr.createSvgTag({ cellSize: 1, margin: 0, scalable: true })
      })
      .then((s) => {
        if (alive) setSvg(s)
      })
      .catch(() => {
        /* offline / blocked — the visitor still has the "Get Nimiq Pay" link below */
      })
    return () => {
      alive = false
    }
  }, [text])

  return (
    <div className="gate-qr" aria-label="QR code to open Stakes in Nimiq Pay">
      {svg ? <span className="gate-qr-img" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="gate-qr-load" />}
    </div>
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
