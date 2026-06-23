import { Suspense, lazy, useEffect, useState } from 'react'
import { CreateScreen } from './product/CreateScreen.tsx'
import { JoinScreen } from './product/JoinScreen.tsx'
import { ProgressScreen } from './product/ProgressScreen.tsx'
import { ResultsScreen } from './product/ResultsScreen.tsx'
import { isTestMode, setTestMode } from './product/store.ts'

// Recon is a dev tool — lazy-load it so its (dark) styles never touch the product.
const Recon = lazy(() => import('./recon/Recon.tsx').then((m) => ({ default: m.Recon })))

type View =
  | { name: 'create' }
  | { name: 'join'; id: string }
  | { name: 'progress'; id: string }
  | { name: 'results'; id: string }
  | { name: 'recon' }

function readView(): View {
  const p = new URLSearchParams(location.search)
  if (p.has('recon')) return { name: 'recon' }
  const r = p.get('r')
  if (r) return { name: 'results', id: r }
  const pg = p.get('p')
  if (pg) return { name: 'progress', id: pg }
  const c = p.get('c')
  if (c) return { name: 'join', id: c }
  return { name: 'create' }
}

function syncUrl(view: View) {
  const url = new URL(location.href)
  url.search = ''
  if (view.name === 'join') url.searchParams.set('c', view.id)
  if (view.name === 'progress') url.searchParams.set('p', view.id)
  if (view.name === 'results') url.searchParams.set('r', view.id)
  if (view.name === 'recon') url.searchParams.set('recon', '1')
  history.replaceState(null, '', url.toString())
}

export function App() {
  const [view, setView] = useState<View>(readView)
  const [testMode, setTestModeState] = useState<boolean>(() => isTestMode())

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('test')) {
      const on = params.get('test') !== '0'
      setTestMode(on)
      setTestModeState(on)
    }
    const onPop = () => setView(readView())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function go(v: View) {
    setView(v)
    syncUrl(v)
    window.scrollTo({ top: 0 })
  }

  if (view.name === 'recon') {
    return (
      <Suspense fallback={null}>
        <Recon />
      </Suspense>
    )
  }

  return (
    <div className="stakes">
      <div className="s-top">
        <span className="s-wordmark" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'create' })}>
          <span className="dot" /> Stakes
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {testMode && (
            <span className="s-link" style={{ color: 'var(--stake)' }}>
              ⚡ test
            </span>
          )}
          <button className="s-link" onClick={() => go({ name: 'recon' })}>
            recon
          </button>
        </span>
      </div>

      {view.name === 'create' && (
        <CreateScreen
          onOpenJoin={(id) => go({ name: 'join', id })}
          onEnter={(id) => go({ name: 'progress', id })}
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
