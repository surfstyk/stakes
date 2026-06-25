// Helpers for the share moment. We deliberately do NOT use `<a download>` of a blob
// URL — inside the Nimiq Pay WebView that opens a dead-end full-screen image viewer.
// Instead the composer shows the PNG as an <img> the user can press-and-hold to save
// (iOS then offers Save to Photos + the native share sheet) — the reliable
// "post to your story" path in a WebView.

export function canvasToPngUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

// Legacy synchronous copy. Critically, this works over LAN HTTP (insecure context),
// where `navigator.clipboard` is undefined — but it MUST run inside the user gesture
// (so call it before any `await`). The contentEditable+readonly dance is the iOS
// WKWebView recipe for execCommand('copy').
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.readOnly = true
    ta.contentEditable = 'true'
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)

    const range = document.createRange()
    range.selectNodeContents(ta)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    ta.setSelectionRange(0, text.length)

    const ok = document.execCommand('copy')
    sel?.removeAllRanges()
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * Copy text to the clipboard, resilient to the WebView's insecure (LAN-HTTP) context.
 * Tries the synchronous legacy path FIRST (works without a secure context and keeps
 * the user gesture), then the modern Clipboard API for HTTPS. Call from inside a tap.
 */
export async function copyText(text: string): Promise<boolean> {
  if (legacyCopy(text)) return true
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* ignore */
    }
  }
  return false
}
