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
// live. Built on the reshape (.rs) design system so a browser visitor meets the same product they
// are about to step into (design 2026-09-09). On both variants the wordmark's full stop is the one
// vermilion bead — the live dot isn't on this surface yet.
//
// Two variants, because Nimiq Pay is a phone app:
//  • TAP  — a device that can run Nimiq Pay (a touch pointer): one button → the App Link opens it.
//  • SCAN — a desktop (no touch pointer): the App Link can't open anything here, so instead of a
//           dead-end button we give the visitor a full-window composition — what Stakes is on the
//           left, a QR that carries them onto their phone on the right.
// ?gate=scan|tap forces a variant (dev builds only), for on-device + headless testing.
type GateVariant = 'scan' | 'tap'

const STREAK = '/illus/arc-streak.svg'
const FORK = '/illus/arc-fork.svg'

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

  if (variant === 'scan') return <DesktopGate />

  // TAP — the phone browser: one button hands off to the wallet.
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
      <Wordmark stake />
      <div className="gate-body">
        <div className="gate-art" aria-hidden="true">
          <img src={FORK} alt="" draggable={false} />
        </div>
        <p className="kicker" style={{ marginTop: 0 }}>
          {g.kicker}
        </p>
        <h1 className="h" style={{ marginTop: 10 }}>
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
      </div>
    </Frame>
  )
}

// The desktop scan gate: a full-window two-panel sheet that owns the browser window (breaks out of
// the .rs 430px phone column via position:fixed). Left = what Stakes is + how it works; right = the
// door, with the real App-Link QR the only object carrying a shadow.
function DesktopGate() {
  const g = copy.gate
  const claim = copy.claim
  return (
    <div className="rs-gd">
      <div className="rs-gd-pitch">
        <div className="rs-gd-brand">
          <span className="rs-gd-wm">
            Stakes<span className="fs">.</span>
          </span>
          <span className="rs-gd-miniapp">{g.miniapp}</span>
        </div>

        <div className="rs-gd-mid">
          <p className="rs-gd-kicker">{g.scanKicker}</p>
          <h2 className="rs-gd-claim">
            {claim.hook}
            <br />
            {claim.payoff}
          </h2>
          <p className="rs-gd-sub">{g.scanSub}</p>
          <div className="rs-gd-art" aria-hidden="true">
            <img src={STREAK} alt="" draggable={false} />
          </div>
        </div>

        <div className="rs-gd-steps">
          {g.steps.map((s, i) => (
            <div className="rs-gd-step" key={i}>
              <span className="rs-gd-step-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="rs-gd-step-t">{s.title}</span>
              <span className="rs-gd-step-l">{s.line}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rs-gd-door">
        <p className="rs-gd-doorkicker">{g.scanDoorKicker}</p>
        <h3 className="rs-gd-doorh">{g.scanPanelH}</h3>

        <div className="rs-qr-card">
          <QrCode text={nimiqPayDeeplink()} />
        </div>

        <p className="rs-gd-cap">
          <CameraIcon />
          {g.scanCap}
        </p>

        <div className="rs-gd-divider" />

        <p className="rs-gd-noapp">{g.noApp}</p>
        <a className="rs-gd-get" href={NIMIQ_PAY_INSTALL_URL} target="_blank" rel="noopener noreferrer">
          {g.getPlain}
          <ExtIcon />
        </a>

        <p className="rs-gd-shield">
          <ShieldCheck />
          {g.guarantee}
        </p>
      </div>
    </div>
  )
}

// The QR of the App Link (nimpay.app/miniapps/open/…) that opens the app in Nimiq Pay on the phone.
// The encoder is lazy-loaded so it never weighs on the mobile (tap) path.
function QrCode({ text }: { text: string }) {
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
        /* offline / blocked — the visitor still has the "Get the app" link below */
      })
    return () => {
      alive = false
    }
  }, [text])

  return (
    <span className="rs-qr" aria-label="QR code to open Stakes in Nimiq Pay">
      {svg ? <span className="rs-qr-img" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="rs-qr-load" />}
    </span>
  )
}

function ShieldCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 3v6c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V5l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 11.5l2 2 4-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .85-.48l.9-1.5A1 1 0 0 1 9.3 3.5h5.4a1 1 0 0 1 .85.52l.9 1.5A1 1 0 0 0 17.3 6h1.2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function ExtIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  )
}
