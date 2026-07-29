import { Suspense, lazy, useEffect, useState } from 'react'
import { CreateScreen } from './product/CreateScreen.tsx'
import { PledgeShareScreen } from './product/PledgeShareScreen.tsx'
import { JoinScreen } from './product/JoinScreen.tsx'
import { ProgressScreen } from './product/ProgressScreen.tsx'
import { ResultsScreen } from './product/ResultsScreen.tsx'
import { WelcomeScreen } from './product/WelcomeScreen.tsx'
import { OpenInNimiqPay } from './product/OpenInNimiqPay.tsx'
import { Loading } from './product/Loading.tsx'
import { hasSeenWelcome, isTestMode, markWelcomeSeen, setTestMode } from './product/store.ts'
import { brand, copy } from './brand/index.ts'
import { DEV_TOOLS } from './lib/flags.ts'
import { isInsideNimiqPay, isRealMoney, watchInsideNimiqPay } from './lib/context.ts'

// Recon is a dev tool — lazy-load it so its (dark) styles never touch the product. The
// inline DEV_TOOLS literal lets the bundler drop the recon chunk entirely in the public build.
const Recon = DEV_TOOLS ? lazy(() => import('./recon/Recon.tsx').then((m) => ({ default: m.Recon }))) : null

type View =
  | { name: 'create' }
  | { name: 'share'; id: string }
  | { name: 'join'; id: string }
  | { name: 'progress'; id: string }
  | { name: 'results'; id: string }
  | { name: 'recon' }

function readView(): View {
  const p = new URLSearchParams(location.search)
  if (DEV_TOOLS && p.has('recon')) return { name: 'recon' }
  const r = p.get('r')
  if (r) return { name: 'results', id: r }
  const pg = p.get('p')
  if (pg) return { name: 'progress', id: pg }
  const s = p.get('s')
  if (s) return { name: 'share', id: s }
  const c = p.get('c')
  if (c) return { name: 'join', id: c }
  return { name: 'create' }
}

function syncUrl(view: View) {
  const url = new URL(location.href)
  url.search = ''
  if (view.name === 'share') url.searchParams.set('s', view.id)
  if (view.name === 'join') url.searchParams.set('c', view.id)
  if (view.name === 'progress') url.searchParams.set('p', view.id)
  if (view.name === 'results') url.searchParams.set('r', view.id)
  if (view.name === 'recon') url.searchParams.set('recon', '1')
  history.replaceState(null, '', url.toString())
}

export function App() {
  const [view, setView] = useState<View>(readView)
  const [testMode, setTestModeState] = useState<boolean>(() => isTestMode())
  const [seenWelcome, setSeenWelcome] = useState<boolean>(() => hasSeenWelcome())
  // The "Open in Nimiq Pay" gate decision. Mock builds are never gated; a real-money build
  // that already sees the host is OK immediately; otherwise we wait briefly for injection
  // (Android seeds the provider a beat after first render) before concluding we're outside.
  const [gate, setGate] = useState<'checking' | 'gate' | 'ok'>(() =>
    !isRealMoney() || isInsideNimiqPay() ? 'ok' : 'checking',
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (DEV_TOOLS && params.has('test')) {
      const on = params.get('test') !== '0'
      setTestMode(on)
      setTestModeState(on)
    }
    const onPop = () => setView(readView())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    // Mock build or host already present → nothing to do (initial state is 'ok').
    if (!isRealMoney() || isInsideNimiqPay()) return
    // Show the gate for genuine browsers after a short grace…
    const grace = setTimeout(() => setGate((g) => (g === 'checking' ? 'gate' : g)), 1500)
    // …but keep watching: if the host appears later (Android injection lag, or the user
    // finishing the Nimiq Pay passcode-unlock), auto-advance INTO the app — gate self-heals,
    // no re-tap. `setGate('ok')` wins over the grace timer's checking→gate.
    const stop = watchInsideNimiqPay(() => setGate('ok'))
    return () => {
      clearTimeout(grace)
      stop()
    }
  }, [])

  function go(v: View) {
    setView(v)
    syncUrl(v)
    window.scrollTo({ top: 0 })
  }

  if (view.name === 'recon' && Recon) {
    return (
      <Suspense fallback={null}>
        <Recon />
      </Suspense>
    )
  }

  // The viral-loop gate: in a real-money build the app only works inside Nimiq Pay (real
  // wallet identity + real deposits). Opened outside it (e.g. an invite link tapped in a
  // normal browser), route the user IN instead of letting them silently "join"/"create"
  // against the mock vault under a throwaway identity — the trap that quietly killed the
  // loop. Mock/dev builds have no funds at risk, so they stay clickable in a plain browser.
  // (Recon, a dev diagnostic, is handled above so it stays reachable for debugging.)
  // `checking` = waiting on provider injection (see the grace-period note) — show a spinner,
  // not the gate, so we never flash the gate inside Nimiq Pay while the host is still wiring up.
  if (gate === 'checking') {
    return (
      <div className="stakes">
        <Loading />
      </div>
    )
  }
  if (gate === 'gate') {
    const c = new URLSearchParams(location.search).get('c')
    return (
      <div className="stakes">
        <OpenInNimiqPay challengeId={c ?? undefined} />
      </div>
    )
  }

  // First-run welcome for an organic opener (deeplinks land on their own screen).
  if (view.name === 'create' && !seenWelcome) {
    return (
      <div className="stakes">
        <WelcomeScreen
          onStart={() => {
            markWelcomeSeen()
            setSeenWelcome(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="stakes">
      <div className="s-top">
        <span className="s-wordmark" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'create' })}>
          {brand.hasDot && <span className="dot" />} {copy.app.wordmark}
        </span>
        {DEV_TOOLS && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {testMode && (
              <span className="s-link" style={{ color: 'var(--stake)' }}>
                {copy.app.test}
              </span>
            )}
            <button className="s-link" onClick={() => go({ name: 'recon' })}>
              {copy.app.recon}
            </button>
          </span>
        )}
      </div>

      {view.name === 'create' && (
        <CreateScreen
          onShare={(id) => go({ name: 'share', id })}
          onEnter={(id) => go({ name: 'progress', id })}
        />
      )}
      {view.name === 'share' && (
        <PledgeShareScreen
          challengeId={view.id}
          onEnter={(id) => go({ name: 'progress', id })}
          onOpenJoin={(id) => go({ name: 'join', id })}
          onCreate={() => go({ name: 'create' })}
        />
      )}
      {view.name === 'join' && (
        <JoinScreen
          challengeId={view.id}
          onCreateOwn={() => go({ name: 'create' })}
          onEnter={(id) => go({ name: 'progress', id })}
        />
      )}
      {view.name === 'progress' && (
        <ProgressScreen
          challengeId={view.id}
          onResults={(id) => go({ name: 'results', id })}
          onCreate={() => go({ name: 'create' })}
        />
      )}
      {view.name === 'results' && (
        <ResultsScreen challengeId={view.id} onHome={() => go({ name: 'create' })} />
      )}
    </div>
  )
}
