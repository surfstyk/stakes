import { TREASURY_NIM_ADDRESS } from '../vault/custodialNim.ts'

// Single source of truth for "where is this app running?" + the Nimiq Pay deeplink.
//
// The trap this defends against (the headline UX bug): a shared invite link
// (https://stakes.surfstyk.com/?c=<id>) tapped in a normal mobile browser opens OUTSIDE
// Nimiq Pay. There, the wallet provider is absent — so without a gate the app would fall
// back to a throwaway dev identity + the mock vault: the user "joins", nothing real
// happens, it looks like it worked, and the viral loop silently dies. So in a real-money
// build we refuse to run outside Nimiq Pay and route the user in via the deeplink instead.

/**
 * True when running inside Nimiq Pay. The host seeds `window.nimiqPay` synchronously
 * before our page script runs (per @nimiq/mini-app-sdk), so this is reliable on the very
 * first render — no interstitial flash inside Nimiq Pay. `window.nimiq` (the provider) may
 * be injected a tick later; either signal counts as "inside".
 */
export function isInsideNimiqPay(): boolean {
  return typeof window !== 'undefined' && (Boolean(window.nimiqPay) || Boolean(window.nimiq))
}

/**
 * True when this build is wired to real funds (treasury configured at build time). A mock
 * build has no money at risk, so it stays fully clickable in a plain browser (local dev,
 * headless testing) and is never gated.
 */
export function isRealMoney(): boolean {
  return Boolean(TREASURY_NIM_ADDRESS)
}

/**
 * Watch for the Nimiq Pay host to appear, calling `onInside()` the instant
 * `window.nimiqPay` / `window.nimiq` shows up (immediately if already present).
 *
 * Why a *watcher* and not a one-shot timeout: the host is supposed to seed those globals
 * synchronously before our script runs — iOS does — but on Android they land a beat later,
 * and worse, if Nimiq Pay throws up its **passcode-unlock** screen on launch the provider
 * isn't injected until the user finishes unlocking (which can take many seconds). A fixed
 * grace window can't cover that, so we keep watching indefinitely — via a poll AND the
 * visibility/focus/pageshow events that fire when the user returns from the lock screen —
 * so the gate SELF-HEALS into the app instead of dead-ending and forcing a re-tap.
 *
 * Returns a cleanup function. Pair this with a short grace timer (see App) that shows the
 * gate for genuine browsers, where the host never appears.
 */
export function watchInsideNimiqPay(onInside: () => void): () => void {
  if (isInsideNimiqPay()) {
    onInside()
    return () => {}
  }
  function check() {
    if (isInsideNimiqPay()) {
      stop()
      onInside()
    }
  }
  function stop() {
    clearInterval(poll)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    window.removeEventListener('pageshow', check)
  }
  const poll = setInterval(check, 250)
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  window.addEventListener('pageshow', check)
  return stop
}

/**
 * One foreground/background lifecycle signal, timestamped. Emitted by watchResumeEvents.
 * `type` is the raw event; `visibility` is document.visibilityState at that instant;
 * `persisted` is set for pageshow (came from the bfcache) and freeze/resume where the UA
 * reports it. `at` is Date.now() at the moment it fired — the field the #209 diagnostic
 * hinges on (a timestamp landing DURING the frozen window means our JS was still alive).
 */
export type ResumeEvent = {
  type: 'focus' | 'blur' | 'pageshow' | 'pagehide' | 'visibilitychange' | 'resume' | 'freeze'
  visibility: DocumentVisibilityState
  persisted?: boolean
  at: number
}

/** Foreground ("we're back") signals — the ones a self-heal on resume would react to. */
export const RESUME_TYPES: ReadonlyArray<ResumeEvent['type']> = ['focus', 'pageshow', 'resume']
export function isResumeSignal(e: ResumeEvent): boolean {
  return RESUME_TYPES.includes(e.type) || (e.type === 'visibilitychange' && e.visibility === 'visible')
}

/**
 * Lifetime watcher for the foreground/background lifecycle. UNLIKE watchInsideNimiqPay
 * (which self-removes the instant the host appears), this NEVER detaches — it exists to
 * observe every background→return for the whole session.
 *
 * It reports the raw signals without debouncing, because the OPEN question it answers is
 * empirical: after Nimiq Pay backgrounds and re-presents our WebView (the frozen-composite
 * bug, nimiq/developer-center#209), does our JS still receive ANY of these on return? If it
 * does, a self-heal `location.reload()` is possible; if nothing fires, the WebView JS is
 * suspended and no JS workaround exists. The caller decides what counts as a "resume"
 * (see isResumeSignal) and what to do with it.
 *
 * Returns a cleanup function. In practice it lives for the whole session.
 */
export function watchResumeEvents(onEvent: (e: ResumeEvent) => void): () => void {
  const emit = (type: ResumeEvent['type'], persisted?: boolean) =>
    onEvent({ type, visibility: document.visibilityState, persisted, at: Date.now() })

  const onFocus = () => emit('focus')
  const onBlur = () => emit('blur')
  const onVis = () => emit('visibilitychange')
  const onPageShow = (e: Event) => emit('pageshow', (e as PageTransitionEvent).persisted)
  const onPageHide = (e: Event) => emit('pagehide', (e as PageTransitionEvent).persisted)
  // Page Lifecycle API (Chromium): fires on the frozen→active transition. Absent on iOS
  // WKWebView, so a no-op there — the visibility/pageshow/focus trio carries the load.
  const onResume = () => emit('resume')
  const onFreeze = () => emit('freeze')

  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('resume', onResume as EventListener)
  document.addEventListener('freeze', onFreeze as EventListener)

  return () => {
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('resume', onResume as EventListener)
    document.removeEventListener('freeze', onFreeze as EventListener)
  }
}

// A "native op in flight" latch — set while a native confirm dialog / on-chain tx is pending
// (see ReshapeApp.guard). The resume-heal reload consults it so a self-heal can NEVER fire over
// a payment/deposit that's mid-signing. It's a nesting counter, not a boolean, so overlapping
// guarded calls don't clear it early.
let sensitiveOps = 0
export function markSensitiveOp(inFlight: boolean): void {
  sensitiveOps = Math.max(0, sensitiveOps + (inFlight ? 1 : -1))
}
export function sensitiveOpInFlight(): boolean {
  return sensitiveOps > 0
}

/** Official page to install Nimiq Pay (routes to the right store for iOS/Android). */
export const NIMIQ_PAY_INSTALL_URL = 'https://www.nimiq.com/nimiq-pay/'

/**
 * Build the link that opens `targetUrl` INSIDE Nimiq Pay.
 *
 * Format — the App Link (HTTPS) form documented at nimiq.dev/mini-apps ("Sharing your
 * Mini App"):
 *   https://nimpay.app/miniapps/open/<host><path><query>
 *
 * Why NOT the custom scheme (`nimiqpay://miniapp?url=…`): it works on a cold start but is
 * silently DISCARDED when Nimiq Pay is already running (foreground or background) — the tap
 * only brings the app forward and drops the URL, with no unknown-link confirmation. For our
 * audience (Nimiq Pay users, usually with the app already backgrounded) that is the common
 * case, so the custom scheme dead-ends the share/entry loop. The App Link is a plain HTTPS
 * URL the OS routes to Nimiq Pay whether it is cold or warm, and it is the fix a Nimiq team
 * member pointed at for this exact bug (same territory as nimiq/developer-center#209).
 *
 * Transform: strip the scheme from the target and hang host + path (+ query) off
 * `/miniapps/open/`. e.g. `https://app.stakes.day/?c=abc` →
 * `https://nimpay.app/miniapps/open/app.stakes.day/?c=abc`. The inner value is passed
 * UNENCODED (the docs' own examples are unencoded; our ids/params are URL-safe). Whether the
 * App Link forwards the inner QUERY string to the WebView the way the custom scheme did is
 * the open on-device question — the docs' example is path-based, so the durable carrier for a
 * share tag is a path segment (`/r/<tag>`), not `?t=`. This is the single place to change.
 */
export function nimiqPayDeeplink(targetUrl: string = location.href): string {
  const bare = targetUrl.replace(/^https?:\/\//, '')
  return `https://nimpay.app/miniapps/open/${bare}`
}

/** Hand off to Nimiq Pay (same tab → the OS intercepts the HTTPS App Link). */
export function openInNimiqPay(targetUrl: string = location.href): void {
  location.href = nimiqPayDeeplink(targetUrl)
}
