// The locked hexagon geometry — ported VERBATIM from surfstyk-notes/brand/gen-hex.mjs
// (the private mark generator). This is what makes "nothing in the system renders the
// symbol at another ratio" true inside the app: corner radius = bead radius = 0.4 × R.
// Nimiq's orientation (flat top/bottom, vertices left/right), corners softened to rhyme
// with the bead. Do not fork these numbers — regenerate assets from gen-hex.mjs so the
// icon, the wordmark's full stop, and the in-app day-states are one asset.

export const RATIO = 0.4
export const SQ3 = Math.sqrt(3)

/** Regular flat-top hexagon vertices, Nimiq orientation (points left/right). */
export function hexVerts(cx: number, cy: number, R: number): [number, number][] {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k * 60 * Math.PI) / 180
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number]
  })
}

/**
 * Rounded-corner hexagon path.
 * Interior angle is 120°, so for corner radius r the tangent cut-back along each edge
 * is r / tan(60°) = r × 0.5774. Clamped so corners can never overrun an edge.
 */
export function roundedHex(cx: number, cy: number, R: number, r: number): string {
  const V = hexVerts(cx, cy, R)
  const edge = R // side length of a regular hexagon equals its circumradius
  const d = Math.min(r * 0.57735, edge / 2 - 0.01)
  const rr = d / 0.57735
  const seg: string[] = []
  for (let i = 0; i < 6; i++) {
    const P = V[(i + 5) % 6]
    const C = V[i]
    const N = V[(i + 1) % 6]
    const to = ([x, y]: [number, number], [px, py]: [number, number]): [number, number] => {
      const dx = px - x
      const dy = py - y
      const L = Math.hypot(dx, dy)
      return [x + (dx / L) * d, y + (dy / L) * d]
    }
    const A = to(C, P) // cut back toward the previous vertex
    const B = to(C, N) // cut back toward the next vertex
    seg.push(
      `${i === 0 ? 'M' : 'L'}${A[0].toFixed(2)} ${A[1].toFixed(2)}` +
        `A${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 1 ${B[0].toFixed(2)} ${B[1].toFixed(2)}`,
    )
  }
  return seg.join('') + 'Z'
}
