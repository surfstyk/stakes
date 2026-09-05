import { isResumeSignal, sensitiveOpInFlight, watchResumeEvents, type ResumeEvent } from './context.ts'

// Step 2 of the Nimiq Pay resume-freeze workaround (nimiq/developer-center#209).
//
// Step 1 (the ?heal probe) proved on-device that our JS stays ALIVE inside the frozen composite:
// the visibilitychange→visible event fires on return and the DOM keeps repainting. So the freeze
// is a native input/z-order bug over a live WebView, not a JS suspension — which means a
// JS-initiated location.reload() (no user input needed) can force the container to re-present.
//
// This module owns the persisted event log (shared with the HealProbe overlay) and the reload
// policy. It's imported only by the (dev-gated, lazy) HealProbe, so it's tree-shaken out of the
// public build. The reload is gated so an ordinary quick tab-out never triggers it, and a
// sensitive native op (a payment/deposit mid-signing) suppresses it entirely.

export type HealLogEntry = { type: string; vis: string; at: number; persisted?: boolean }

const LOG_KEY = 'stakes.heal.log.v1'
const MAX = 80

export function readHealLog(): HealLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (raw) return JSON.parse(raw) as HealLogEntry[]
  } catch {
    /* private mode / corrupt — start clean */
  }
  return []
}
export function appendHealLog(entry: HealLogEntry): HealLogEntry[] {
  const next = [...readHealLog(), entry].slice(-MAX)
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}
export function clearHealLog(): void {
  try {
    localStorage.removeItem(LOG_KEY)
  } catch {
    /* ignore */
  }
}

export type HealOptions = {
  /** true → auto-reload on a qualifying resume (Step 2); false → observe + log only (Step 1). */
  reload: boolean
  /** Only reload if the page was hidden at least this long — skips quick tab-outs. */
  minHiddenMs?: number
  /** Called with the just-appended entry + the full log, for the live overlay. */
  onEvent?: (entry: HealLogEntry, log: HealLogEntry[]) => void
  /** Called right before location.reload() fires (e.g. to persist extra context). */
  onReload?: () => void
}

/**
 * Install the lifetime resume watcher: log every lifecycle event (for the overlay), and — when
 * `reload` is on — force a state-preserving location.reload() on the first foreground signal after
 * a real background. The app rehydrates the active run from the server/localStorage on load, so a
 * reload lands the user back on their current screen (a flash, not a lost session).
 *
 * Returns a cleanup function.
 */
export function startResumeHeal(opts: HealOptions): () => void {
  const minHidden = opts.minHiddenMs ?? 1000
  const loadedAt = Date.now()
  // If we booted already-hidden, count "hidden since load" so a return still qualifies.
  let hiddenSince: number | null = document.visibilityState === 'hidden' ? loadedAt : null

  return watchResumeEvents((e: ResumeEvent) => {
    const entry: HealLogEntry = { type: e.type, vis: e.visibility, at: e.at, persisted: e.persisted }
    const log = appendHealLog(entry)
    opts.onEvent?.(entry, log)

    // Track the start of the current hidden window from whatever signal reports hidden.
    if (e.visibility === 'hidden') {
      if (hiddenSince == null) hiddenSince = e.at
      return
    }

    if (!opts.reload) return
    if (!isResumeSignal(e) || document.visibilityState !== 'visible') return

    const hiddenMs = hiddenSince == null ? 0 : e.at - hiddenSince
    hiddenSince = null // consume the window; the next hidden opens a fresh one

    // Guards: ignore the resume signals that fire on first paint (no real prior background);
    // require a real background of at least minHidden; never reload over a native payment.
    if (e.at - loadedAt < 800) return
    if (hiddenMs < minHidden) return
    if (sensitiveOpInFlight()) return

    appendHealLog({ type: 'RELOAD', vis: document.visibilityState, at: Date.now() })
    opts.onReload?.()
    location.reload()
  })
}
