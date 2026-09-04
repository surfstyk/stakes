// One Light challenge illustrations — path helpers (behind the ILLUS flag until go-live).
//
// Studio delivers lossless PNG source at 960×630 (3× of the 320×210 scene, riso grain baked, no
// live SVG filter ships); the source lives in the handoff bundle. We SHIP WebP (q≈82, ~10 KB
// each vs ~200 KB PNG — the flat-ink scenes crush hard and the halftone tint + dot gradient hold
// at q82), lazy-loaded. Two variants per challenge, ids matching templates.ts:
//   <id>--card.webp    — WITH the dot (the cold-open deck; the illustration carries the one light)
//   <id>--journey.webp — dot-free (in-journey: the day banner) so the live sphere stays the one bead
// Served from public/illus/.

import { ILLUS } from '../lib/flags.ts'

export const illusOn = ILLUS

const base = import.meta.env.BASE_URL // honours Vite's configured base path

/** The with-dot deck-card scene for a challenge (the cold open). */
export const cardArt = (templateId: string): string => `${base}illus/${templateId}--card.webp`

/** The dot-free in-journey scene (the day banner). */
export const journeyArt = (templateId: string): string => `${base}illus/${templateId}--journey.webp`
