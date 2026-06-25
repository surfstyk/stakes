// Sharing the rendered card. On HTTPS the right path is the native share sheet with
// the PNG as a *file* (→ post straight to a story, caption + link included). Both
// navigator.share and navigator.clipboard are secure-context-only, which is why they
// silently failed over LAN HTTP; on the deployed HTTPS app they work.

export function canvasToPngUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

// Synchronous dataURL → Blob, so we can build the share File without an async
// `toBlob` — native share must be invoked inside the user gesture (no awaits first).
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Open the native share sheet with the card image + caption. MUST be called
 * synchronously inside a user gesture (don't await anything before it). Returns the
 * in-flight share promise, or `null` if file-sharing isn't available (→ caller shows
 * the in-app fallback).
 */
export function shareImageNative(
  canvas: HTMLCanvasElement,
  filename: string,
  text: string,
): Promise<void> | null {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data?: ShareData) => Promise<void>
  }
  if (!nav.share || !nav.canShare) return null
  const file = new File([dataUrlToBlob(canvas.toDataURL('image/png'))], filename, { type: 'image/png' })
  if (!nav.canShare({ files: [file] })) return null
  return nav.share({ files: [file], text })
}

// Legacy synchronous copy — last resort for browsers without the Clipboard API.
// Must run inside the user gesture.
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

/** Copy text — modern Clipboard API first (reliable on HTTPS), legacy as fallback. */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* fall through to legacy */
    }
  }
  return legacyCopy(text)
}
