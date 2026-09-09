import { useEffect, useState } from 'react'
import { copy } from '../brand/index.ts'
import type { Challenge, HistoryItem } from './model.ts'
import { currentDay, effectiveStatus, goalRecord, hasFreshMiss, isRunOver } from './model.ts'
import { data, devSeed, hasKnownIdentity, type SeedKind } from './data.ts'
import type { Template } from './templates.ts'
import { DEV_TOOLS } from '../lib/flags.ts'
import { DayScreen, MainScreen, MakeOfficialScreen, SealShareScreen, TasteScreen } from './screens.tsx'
import { ArchiveScreen, BankedScreen, LapsedScreen, MissedScreen, ReUpScreen } from './screens2.tsx'
import { Frame, Wordmark } from './ui.tsx'
import { isUserCancel } from '../lib/nimiq.ts'
import { markSensitiveOp } from '../lib/context.ts'

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

  // The landing rule: active run → its screen · else the cold open. The front door is always the
  // invitation to commit, never the backward-looking record — a returning wallet with past runs but
  // nothing live lands on Create, same as a newcomer (the record stays reachable, it just isn't the
  // landing). Fixes "opening the app drops me on Your Record" (a returning/tester wallet, 2026-09-09).
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
    setView('main')
  }

  useEffect(() => {
    if (DEV_TOOLS) {
      const q = new URLSearchParams(location.search).get('rs')
      const seed: Record<string, SeedKind> = {
        clear: 'clear',
        'seed-taste': 'taste',
        'view-official': 'taste',
        'seed-day': 'day',
        'seed-longrun': 'long',
        'seed-sealed': 'sealed',
        'view-seal': 'sealone',
        missed: 'missed',
        'banked-win': 'banked-win',
        'banked-partial': 'banked-partial',
        'banked-wipeout': 'banked-wipeout',
        reup: 'reup',
        lapsed: 'lapsed',
        archive: 'archive',
      }
      const forced: Record<string, View> = { 'view-official': 'official', 'view-seal': 'sealShare', reup: 'reup' }
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
    // Instant paint, never a Connect sheet over a blank wordmark. An identity we can't resolve
    // silently (a first-ever visit, before any wallet connect) lands straight on the cold-open —
    // the first real action is where the native connect happens. A known identity (the dev id, or
    // a returning wallet we cached) loads its state silently, but BOUNDED: if the load stalls we
    // fall to the cold-open rather than hang on the wordmark (the freeze the screenshots showed).
    if (!hasKnownIdentity()) {
      setView('main')
      return
    }
    let settled = false
    const escape = setTimeout(() => {
      if (!settled) setView('main')
    }, 8000)
    void refresh()
      .catch(() => setView('main'))
      .finally(() => {
        settled = true
        clearTimeout(escape)
      })
  }, [])

  const home = () => void refresh()

  async function guard(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    // Latch "a native op is in flight" so the resume-heal reload (#209 Step 2) can never fire
    // over a payment/deposit mid-signing. No-op unless ?selfheal is active.
    markSensitiveOp(true)
    try {
      await fn()
    } catch (e) {
      // Never surface a raw provider string: a user backing out of the native dialog
      // is a calm "nothing happened", anything else is a clear, retryable failure.
      if (import.meta.env.DEV) console.warn('[stakes] action failed:', e)
      setError({ kind: isUserCancel(e) ? 'cancel' : 'error' })
    } finally {
      setBusy(false)
      markSensitiveOp(false)
    }
  }

  const onStart = (t: Template) =>
    guard(async () => {
      // Point 2 (handoff 2026-09-04): starting a different challenge while a taste is still
      // running silently REPLACES it — the soft escape, no cancel dialog. Only ever a taste
      // (unstaked `window`); a staked run is forward-only and never reached from the picker.
      if (challenge && effectiveStatus(challenge) === 'window') {
        await data.deleteAttempt(challenge.id)
      }
      const ch = await data.startChallenge(t.id)
      setChallenge(ch)
      setView('taste')
    })

  // The challenge chip's tap during a taste → back to the picker (where starting another replaces it).
  const toPicker = () => setView('main')

  const onOfficial = (stake: { perDay: number; days: number }) =>
    guard(async () => {
      if (!challenge) return
      // makeOfficial REJECTS if the native deposit is declined/cancelled (custodial vault →
      // txHashOrThrow), so a cancel throws here and never advances. Only move to the running
      // day once the stake is genuinely on — never on a decline (handoff 2026-09-04).
      const ch = await data.makeOfficial(challenge.id, stake)
      setChallenge(ch)
      if (ch.status === 'official') setView('day')
    })

  const onSeal = () =>
    guard(async () => {
      if (!challenge) return
      const ch = await data.sealDay(challenge.id)
      setChallenge(ch)
      // Every seal lands on the 06 sealed ledger; "Show someone" from there raises the 07 postcard
      // (design update 2026-09-08: the card is every kept day, not just day one). The Perfect-Week
      // milestone was cut (catalogue deprecation), so a clean sub-week just stays on the day screen.
      if (isRunOver(ch)) setView('banked')
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
      return <TasteScreen challenge={challenge} onMakeCount={() => setView('official')} onPicker={toPicker} onWordmark={home} />
    case 'official':
      return <MakeOfficialScreen challenge={challenge} busy={busy} error={error} onOfficial={onOfficial} onPicker={toPicker} onWordmark={home} />
    case 'sealShare':
      return (
        <SealShareScreen
          challenge={challenge}
          onShare={() =>
            void share(currentDay(challenge) === 0 ? copy.share.sealDay1(challenge.emoji, challenge.goal) : copy.share.dayKept(challenge.emoji, challenge.goal))
          }
          onWordmark={home}
        />
      )
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
    default:
      return (
        <DayScreen
          challenge={challenge}
          busy={busy}
          error={error}
          onSeal={onSeal}
          onShowSomeone={() => setView('sealShare')}
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
