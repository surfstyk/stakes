import { theme } from './theme.ts'
import { brand } from './brand.ts'

/**
 * Inject the theme tokens onto :root as CSS custom properties and set the document
 * title from the brand. Call once at boot, before first paint (see main.tsx), so the
 * whole stylesheet — which reads var(--…) — is driven by src/brand, the single source
 * of truth. product.css keeps the same values as static fallbacks, so there's no
 * flash if this runs a tick late.
 */
export function applyBrand() {
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  const c = theme.color

  set('--paper', c.paper)
  set('--paper-card', c.paperCard)
  set('--paper-sunk', c.paperSunk)
  set('--ink', c.ink)
  set('--ink-soft', c.inkSoft)
  set('--ink-faint', c.inkFaint)
  set('--line', c.line)
  set('--line-strong', c.lineStrong)
  set('--stake', c.stake)
  set('--stake-deep', c.stakeDeep)
  set('--stake-tint', c.stakeTint)
  set('--go', c.go)
  set('--go-tint', c.goTint)
  set('--gold', c.gold)

  set('--font-display', theme.font.display)
  set('--font-ui', theme.font.ui)
  set('--r-card', theme.radius.card)
  set('--r-btn', theme.radius.btn)
  set('--shadow-card', theme.shadow.card)
  set('--shadow-pop', theme.shadow.pop)

  document.title = `${brand.name} — ${brand.tagline}`
}
