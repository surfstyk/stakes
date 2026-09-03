import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, HistoryItem } from './model.ts'
import { currentDay, effectiveStatus, goalRecord, hasFreshMiss, isRunOver, keptDays } from './model.ts'
import { data, devSeed, type SeedKind } from './data.ts'
import type { Template } from './templates.ts'
import { DEV_TOOLS } from '../lib/flags.ts'
import { DayScreen, MainScreen, MakeOfficialScreen, SealShareScreen, TasteScreen } from './screens.tsx'
import { ArchiveScreen, BankedScreen, LapsedScreen, MissedScreen, PerfectWeekScreen, ReUpScreen } from './screens2.tsx'
import { Frame, Wordmark } from './ui.tsx'
import { isUserCancel } from '../lib/nimiq.ts'

type View =
  | 'loading'
  | 'main'
  | 'taste'
  | 'official'
  | 'day'
  | 'sealShare'
  | 'banked'
  | 'reup'
  | 'archive'
  | 'missed'
  | 'lapsed'
  | 'perfectweek'

// Best-effort native share; the link is the reliable payload inside the Nimiq Pay WebView.
async function share(text: string, url = location.origin) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url })
      return
    }
  } catch {
    /* cancelled / unsupported */
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
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: 'cancel' | 'error' } | null>(null)

  // The landing rule: active run → its screen · else history → Archive · else Create.
  async function refresh() {
    const me = await data.getMe()
    setChallenge(me.active)
    setHistory(me.history)
    if (me.active) {
      const st = effectiveStatus(me.active)
      if (st === 'window') return setView('taste')
      if (st === 'lapsed') return setView('lapsed')
      if (st === 'ended' || st === 'settled') return setView('banked')
      // official & running
      return setView(hasFreshMiss(me.active) ? 'missed' : 'day')
    }
    setView(me.history.length ? 'archive' : 'main')
  }

  useEffect(() => {
    if (DEV_TOOLS) {
      const q = new URLSearchParams(location.search).get('rs')
      const seed: Record<string, SeedKind> = {
        clear: 'clear',
        'seed-taste': 'taste',
        'view-official': 'taste',
        'seed-day': 'day',
        'seed-sealed': 'sealed',
        'view-seal': 'sealone',
        missed: 'missed',
        'banked-win': 'banked-win',
        'banked-partial': 'banked-partial',
        'banked-wipeout': 'banked-wipeout',
        reup: 'reup',
        lapsed: 'lapsed',
        archive: 'archive',
        perfectweek: 'banked-win',
      }
      const forced: Record<string, View> = { 'view-official': 'official', 'view-seal': 'sealShare', reup: 'reup', perfectweek: 'perfectweek' }
      if (q && seed[q]) {
        devSeed(seed[q])
        void data.getMe().then((me) => {
          setChallenge(me.active)
          setHistory(me.history)
          if (forced[q]) setView(forced[q])
          else void refresh()
        })
        return
      }
    }
    void refresh()
  }, [])

  const home = () => void refresh()

  async function guard(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      // Never surface a raw provider string: a user backing out of the native dialog
      // is a calm "nothing happened", anything else is a clear, retryable failure.
      if (import.meta.env.DEV) console.warn('[stakes] action failed:', e)
      setError({ kind: isUserCancel(e) ? 'cancel' : 'error' })
    } finally {
      setBusy(false)
    }
  }

  const onStart = (t: Template) =>
    guard(async () => {
      const ch = await data.startChallenge(t.id)
      setChallenge(ch)
      setView('taste')
    })

  const onOfficial = (stake: { perDay: number; days: number }) =>
    guard(async () => {
      if (!challenge) return
      const ch = await data.makeOfficial(challenge.id, stake)
      setChallenge(ch)
      setView('day')
    })

  const onSeal = () =>
    guard(async () => {
      if (!challenge) return
      const wasDayOne = currentDay(challenge) === 0
      const ch = await data.sealDay(challenge.id)
      setChallenge(ch)
      const d = currentDay(ch)
      const kept = keptDays(ch)
      const cleanWeek = (d + 1) % 7 === 0 && d + 1 < ch.durationDays && Array.from({ length: d + 1 }, (_, i) => i).every((i) => kept.has(i))
      if (isRunOver(ch)) setView('banked')
      else if (cleanWeek) setView('perfectweek')
      else if (wasDayOne) setView('sealShare')
      else setView('day')
    })

  const reRun = (templateId: string) =>
    guard(async () => {
      const ch = await data.reRun(templateId)
      setChallenge(ch)
      setView('official')
    })

  const discardTo = (dest: 'main' | 'refresh') =>
    guard(async () => {
      await data.discardActive()
      if (dest === 'main') {
        setChallenge(null)
        setView('main')
      } else {
        await refresh()
      }
    })

  const onExitTaste = () =>
    guard(async () => {
      if (challenge) await data.deleteAttempt(challenge.id)
      setChallenge(null)
      setView('main')
    })

  // ---- render ----
  if (view === 'loading') {
    return (
      <Frame center>
        <Wordmark onClick={home} />
      </Frame>
    )
  }
  if (view === 'main' || (!challenge && view !== 'archive')) {
    return <MainScreenLoader onStart={onStart} onWordmark={home} />
  }
  if (view === 'archive') {
    return (
      <ArchiveScreen
        history={history}
        onRow={(templateId) => reRun(templateId)}
        onStart={() => setView('main')}
        onWordmark={home}
      />
    )
  }
  if (!challenge) return <MainScreenLoader onStart={onStart} onWordmark={home} />

  switch (view) {
    case 'taste':
      return <TasteScreen challenge={challenge} onMakeCount={() => setView('official')} onExit={onExitTaste} onWordmark={home} />
    case 'official':
      return <MakeOfficialScreen challenge={challenge} busy={busy} error={error} onOfficial={onOfficial} onWordmark={home} />
    case 'sealShare':
      return <SealShareScreen challenge={challenge} onShare={() => void share(copy.share.sealDay1(challenge.emoji, challenge.goal))} onWordmark={home} />
    case 'missed':
      return <MissedScreen challenge={challenge} onWinToday={() => setView('day')} onWordmark={home} />
    case 'lapsed':
      return <LapsedScreen challenge={challenge} onStartAgain={() => discardTo('main')} onWordmark={home} />
    case 'banked':
      return (
        <BankedScreen
          challenge={challenge}
          onShare={() => void share(copy.share.bankedWeek(challenge.emoji, challenge.goal))}
          onGoAgain={() => setView('reup')}
          onReRun={() => reRun(challenge.templateId)}
          onSeeRecord={() => setView('reup')}
          onHome={() => discardTo('refresh')}
          onWordmark={home}
        />
      )
    case 'reup':
      return (
        <ReUpScreen
          challenge={challenge}
          record={goalRecord(history, challenge, challenge.templateId)}
          onAnotherWeek={() => reRun(challenge.templateId)}
          onPickNew={() => discardTo('main')}
          onWordmark={home}
        />
      )
    case 'perfectweek':
      return <PerfectWeekScreen onShare={() => void share(copy.share.perfectWeek(challenge.emoji, challenge.goal))} onWordmark={home} />
    default:
      return (
        <DayScreen
          challenge={challenge}
          busy={busy}
          error={error}
          onSeal={onSeal}
          onShare={() => void share(copy.share.dayKept(challenge.emoji, challenge.goal))}
          onWordmark={home}
        />
      )
  }
}

// The Main screen needs the social counters — a tiny loader so the deck renders once they arrive.
function MainScreenLoader({ onStart, onWordmark }: { onStart: (t: Template) => void; onWordmark: () => void }) {
  const [social, setSocial] = useState<{ startedThisWeek: Record<string, number> } | null>(null)
  useEffect(() => {
    void data.getSocial().then(setSocial)
  }, [])
  return <MainScreen social={social ?? { startedThisWeek: {} }} onStart={onStart} onWordmark={onWordmark} />
}
