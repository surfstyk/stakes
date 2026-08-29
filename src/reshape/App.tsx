import { useEffect, useState } from 'react'
import type { Challenge } from './model.ts'
import { currentDay, effectiveStatus } from './model.ts'
import { data, devSeed } from './data.ts'
import type { Template } from './templates.ts'
import { DEV_TOOLS } from '../lib/flags.ts'
import { DayScreen, MainScreen, MakeOfficialScreen, SealShareScreen, TasteScreen } from './screens.tsx'
import { Frame, Wordmark } from './ui.tsx'

type View = 'loading' | 'main' | 'taste' | 'official' | 'day' | 'sealShare'

// Best-effort native share; the link is the reliable payload inside the Nimiq Pay WebView
// (the SDK has no share bridge — navigator.share where present, clipboard otherwise).
async function share(text: string, url = location.origin) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url })
      return
    }
  } catch {
    /* user cancelled / unsupported */
  }
  try {
    await navigator.clipboard?.writeText(`${text} ${url}`)
  } catch {
    /* ignore */
  }
}

export function ReshapeApp() {
  const [view, setView] = useState<View>('loading')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const me = await data.getMe()
    setChallenge(me.active)
    if (me.active) {
      const st = effectiveStatus(me.active)
      if (st === 'window') return setView('taste')
      if (st === 'official') return setView('day')
    }
    setView('main')
  }

  useEffect(() => {
    // dev seeding for the design run — reach any spine view directly for a headless capture:
    //   ?rs=clear | seed-taste | view-official | seed-day | seed-sealed | view-seal
    if (DEV_TOOLS) {
      const q = new URLSearchParams(location.search).get('rs')
      const seed: Record<string, Parameters<typeof devSeed>[0]> = {
        clear: 'clear',
        'seed-taste': 'taste',
        'view-official': 'taste',
        'seed-day': 'day',
        'seed-sealed': 'sealed',
        'view-seal': 'sealone',
      }
      if (q && seed[q]) {
        devSeed(seed[q])
        void data.getMe().then((me) => {
          setChallenge(me.active)
          if (q === 'view-official') setView('official')
          else if (q === 'view-seal') setView('sealShare')
          else void refresh()
        })
        return
      }
    }
    void refresh()
  }, [])

  const home = () => void refresh()

  async function onStart(t: Template) {
    setError(null)
    setBusy(true)
    try {
      const ch = await data.startChallenge(t.id)
      setChallenge(ch)
      setView('taste')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onOfficial(stake: { perDay: number; days: number }) {
    if (!challenge) return
    setError(null)
    setBusy(true)
    try {
      const ch = await data.makeOfficial(challenge.id, stake)
      setChallenge(ch)
      setView('day')
    } catch (e) {
      setError((e as Error).message || 'That didn’t go through.')
    } finally {
      setBusy(false)
    }
  }

  async function onSeal() {
    if (!challenge) return
    const wasDayOne = currentDay(challenge) === 0
    setError(null)
    setBusy(true)
    try {
      const ch = await data.sealDay(challenge.id)
      setChallenge(ch)
      setView(wasDayOne ? 'sealShare' : 'day')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onExitTaste() {
    if (!challenge) return
    await data.deleteAttempt(challenge.id)
    setChallenge(null)
    setView('main')
  }

  if (view === 'loading') {
    return (
      <Frame center>
        <Wordmark onClick={home} />
      </Frame>
    )
  }

  if (view === 'main') {
    return <MainScreenLoader onStart={onStart} onWordmark={home} />
  }

  if (!challenge) {
    return <MainScreenLoader onStart={onStart} onWordmark={home} />
  }

  if (view === 'taste') {
    return <TasteScreen challenge={challenge} onMakeCount={() => setView('official')} onExit={onExitTaste} onWordmark={home} />
  }
  if (view === 'official') {
    return <MakeOfficialScreen challenge={challenge} busy={busy} error={error} onOfficial={onOfficial} onWordmark={home} />
  }
  if (view === 'sealShare') {
    return (
      <SealShareScreen
        challenge={challenge}
        onShare={() => void share(`Day one, on the record. ${challenge.emoji} ${challenge.goal} — I'm in.`)}
        onWordmark={home}
      />
    )
  }
  // view === 'day'
  return (
    <DayScreen
      challenge={challenge}
      busy={busy}
      error={error}
      onSeal={onSeal}
      onShare={() => void share(`Another day kept. ${challenge.emoji} ${challenge.goal} — still in.`)}
      onWordmark={home}
    />
  )
}

// The Main screen needs the social counters — a tiny loader so the deck renders once they arrive.
function MainScreenLoader({ onStart, onWordmark }: { onStart: (t: Template) => void; onWordmark: () => void }) {
  const [social, setSocial] = useState<{ startedThisWeek: Record<string, number>; inToday: number } | null>(null)
  useEffect(() => {
    void data.getSocial().then(setSocial)
  }, [])
  return <MainScreen social={social ?? { startedThisWeek: {}, inToday: 0 }} onStart={onStart} onWordmark={onWordmark} />
}
