import type { RefObject } from 'react'

/**
 * Bring a required input the user hasn't filled into view (the Create + Join name fields,
 * whose live CTA guides here on tap). Just focus: inside the tap gesture this opens the
 * keyboard, and the WebView's native keyboard-avoidance scrolls the field above it —
 * including a bottom-of-form field, which page-level JS can't (window.scrollBy clamps at
 * max scroll). preventScroll and a keyboard-blind scrollIntoView both fight that and leave
 * the field hidden behind the keyboard, so we do neither.
 */
export function revealField(ref: RefObject<HTMLInputElement>) {
  ref.current?.focus()
}
