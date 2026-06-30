import type { CardStyle } from './types.ts'
import { pledgeTicket } from './styles/pledgeTicket.ts'
import { billboard } from './styles/billboard.ts'
import { midnight } from './styles/midnight.ts'
import { receipt } from './styles/receipt.ts'
import { polaroid_ } from './styles/polaroid.ts'

// The style library. THIS ARRAY is the extension seam: a downloadable / remote /
// bring-your-own style is just another CardStyle pushed in here, and an A/B test is
// a swap of the default-pick logic below. Order = display order in the picker.
export const CARD_STYLES: CardStyle[] = [pledgeTicket, billboard, midnight, receipt, polaroid_]

export function getStyle(id: string | null | undefined): CardStyle {
  return CARD_STYLES.find((s) => s.id === id) ?? CARD_STYLES[0]
}

// Remember the user's last pick so their chosen aesthetic carries across cards.
const LAST_KEY = 'stakes.cardstyle'
export function rememberStyle(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id)
  } catch {
    /* ignore */
  }
}
export function lastStyleId(): string {
  try {
    return localStorage.getItem(LAST_KEY) ?? CARD_STYLES[0].id
  } catch {
    return CARD_STYLES[0].id
  }
}
