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

/** Official page to install Nimiq Pay (routes to the right store for iOS/Android). */
export const NIMIQ_PAY_INSTALL_URL = 'https://www.nimiq.com/nimiq-pay/'

/**
 * Build the deeplink that opens `targetUrl` INSIDE Nimiq Pay.
 *
 * Format — the only one Nimiq Pay documents (nimiq.dev/mini-apps):
 *   nimiqpay://miniapp?url=<app url>
 *
 * The inner URL is passed UNENCODED on purpose. On-device testing proved Nimiq Pay
 * forwards the full query string through to the WebView verbatim: opening
 * `nimiqpay://miniapp?url=https://stakes.surfstyk.com/?test` activated test mode, so an
 * inner `?c=<id>` survives the round-trip. Our ids/params are URL-safe (hex + `=`), so
 * there is nothing to escape. If a future Nimiq Pay build is ever shown to percent-decode
 * this value, switch to `encodeURIComponent(targetUrl)` here — this is the single place
 * to change, and the on-device test in PHASE-5-CHECKLIST.md is the decider.
 */
export function nimiqPayDeeplink(targetUrl: string = location.href): string {
  return `nimiqpay://miniapp?url=${targetUrl}`
}

/** Hand off to Nimiq Pay (same tab → the OS intercepts the custom scheme). */
export function openInNimiqPay(targetUrl: string = location.href): void {
  location.href = nimiqPayDeeplink(targetUrl)
}
