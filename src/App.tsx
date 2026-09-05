import { Suspense, lazy, useEffect, useState } from 'react'
import { OpenInNimiqPay } from './product/OpenInNimiqPay.tsx'
import { Loading } from './product/Loading.tsx'
import { ReshapeApp } from './reshape/App.tsx'
import { setTestMode } from './reshape/data.ts'
import { DEV_TOOLS } from './lib/flags.ts'
import { isInsideNimiqPay, isRealMoney, watchInsideNimiqPay } from './lib/context.ts'

// Recon is a dev tool — lazy-load it so its (dark) styles never touch the product. The
// inline DEV_TOOLS literal lets the bundler drop the recon chunk entirely in the public build.
const Recon = DEV_TOOLS ? lazy(() => import('./recon/Recon.tsx').then((m) => ({ default: m.Recon }))) : null
// ?heal — the resume-freeze (#209) lifecycle probe. Dev-only + lazy, so it's out of the public build.
const HealProbe = DEV_TOOLS ? lazy(() => import('./product/HealProbe.tsx').then((m) => ({ default: m.HealProbe }))) : null

export function App() {
  // Recon is a mount-time diagnostic (?recon), not part of the product's navigation.
  const [isRecon] = useState(() => DEV_TOOLS && new URLSearchParams(location.search).has('recon'))
  // ?heal — the resume-freeze probe overlay, mounted over every state (loading/gate/app).
  const [healOn] = useState(() => DEV_TOOLS && new URLSearchParams(location.search).has('heal'))
  // The "Open in Nimiq Pay" gate decision. Mock builds are never gated; a real-money build
  // that already sees the host is OK immediately; otherwise we wait briefly for injection
  // (Android seeds the provider a beat after first render) before concluding we're outside.
  const [gate, setGate] = useState<'checking' | 'gate' | 'ok'>(() =>
    !isRealMoney() || isInsideNimiqPay() ? 'ok' : 'checking',
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (DEV_TOOLS && params.has('test')) {
      setTestMode(params.get('test') !== '0') // fast-clock; the visible test marker stays hidden
    }
  }, [])

  useEffect(() => {
    // Mock build or host already present → nothing to do (initial state is 'ok').
    if (!isRealMoney() || isInsideNimiqPay()) return
    // Show the gate for genuine browsers after a short grace…
    const grace = setTimeout(() => setGate((g) => (g === 'checking' ? 'gate' : g)), 1500)
    // …but keep watching: if the host appears later (Android injection lag, or the user
    // finishing the Nimiq Pay passcode-unlock), auto-advance INTO the app — gate self-heals.
    const stop = watchInsideNimiqPay(() => setGate('ok'))
    return () => {
      clearTimeout(grace)
      stop()
    }
  }, [])

  if (isRecon && Recon) {
    return (
      <Suspense fallback={null}>
        <Recon />
      </Suspense>
    )
  }

  // The probe sits above whatever the gate resolves to, so it observes the lifecycle from the
  // first paint through the whole session, regardless of loading/gate/app state.
  const probe = healOn && HealProbe ? (
    <Suspense fallback={null}>
      <HealProbe />
    </Suspense>
  ) : null

  // The viral-loop gate: in a real-money build the app only works inside Nimiq Pay (real
  // wallet identity + real deposits). Opened outside it, route the user IN instead of letting
  // them silently transact against the mock vault under a throwaway identity.
  if (gate === 'checking') {
    return (
      <>
        {probe}
        <div className="stakes">
          <Loading />
        </div>
      </>
    )
  }
  if (gate === 'gate') {
    return (
      <>
        {probe}
        <div className="stakes">
          <OpenInNimiqPay />
        </div>
      </>
    )
  }

  // The reshape (Cycle II) — the solo-first journey lives in its own `.rs` frame + state machine.
  return (
    <>
      {probe}
      <div className="rs">
        <ReshapeApp />
      </div>
    </>
  )
}
