// Stakes wax-seal geometry — the single source of the organic seal outline, shared by the DOM
// seal (product/WaxSeal.tsx) and the canvas share card (share/styles/pledgeTicket.ts). It is
// deterministic (mulberry32 seed 7 + the study's params), so both render the exact same shape —
// and it matches the app icon, whose generator (surfstyk-notes/brand/gen.js) is identical.
//
// Authored in a 512×512 space, centred on (256, 256).

const C = 256

export const FLAME_PATH =
  'M12 2c0 0 6 5 6 11a6 6 0 0 1-12 0c0-2 1-3.5 2-4.5 0 1.5 1 2.5 2 2.5-1-3 2-6 2-9z'
export const FLAME_SCALE = 11
export const FLAME_TX = C - 12 * FLAME_SCALE // centre the flame on its bbox centre (12, 10.5)
export const FLAME_TY = C - 10.5 * FLAME_SCALE

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function waxPoints(seed = 7, lobes = 22, baseR = 186, scallop = 9, jitterR = 14, jitterA = 0.5): [number, number][] {
  const rnd = mulberry32(seed)
  const steps = lobes * 2
  const pts: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const isPeak = i % 2 === 0
    const a = (i / steps) * 2 * Math.PI - Math.PI / 2 + (rnd() - 0.5) * jitterA * ((2 * Math.PI) / steps)
    const r = baseR + (isPeak ? scallop : -scallop) + (rnd() - 0.5) * jitterR
    pts.push([C + r * Math.cos(a), C + r * Math.sin(a)])
  }
  return pts
}

const PTS = waxPoints()

/** The seal outline scaled toward the centre by `f` (1 = outer edge, 0.82 = recessed field). */
function scaled(f: number): [number, number][] {
  return PTS.map(([x, y]) => [C + (x - C) * f, C + (y - C) * f])
}

/** Closed Catmull-Rom path through `pts`, as SVG path data (used by <path> and Path2D alike). */
function catmull(pts: [number, number][]): string {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

export const WAX_OUTER_PATH = catmull(scaled(1))
export const WAX_FIELD_PATH = catmull(scaled(0.82))
