// One Light challenge illustrations — path helpers for the prototype (behind the ILLUS flag).
//
// Studio delivers lossless PNG at 960×630 (3× of the 320×210 scene, riso grain baked, no live
// SVG filter ships). Two variants per challenge, ids matching templates.ts:
//   <id>--card.png    — WITH the dot (the cold-open deck; the illustration carries the one light)
//   <id>--journey.png — dot-free (in-journey: the day banner) so the live sphere stays the one bead
// Served from public/illus/. WebP (q≈82) conversion + a build step land at integration; the
// prototype ships the PNG source so on-device tests read crispness at the lossless best case.

import { ILLUS } from '../lib/flags.ts'

export const illusOn = ILLUS

const base = import.meta.env.BASE_URL // honours Vite's configured base path

/** The with-dot deck-card scene for a challenge (the cold open). */
export const cardArt = (templateId: string): string => `${base}illus/${templateId}--card.png`

/** The dot-free in-journey scene (the day banner). */
export const journeyArt = (templateId: string): string => `${base}illus/${templateId}--journey.png`
