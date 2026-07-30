import { useEffect, useState } from 'react'
import { FLAME_PATH, FLAME_SCALE, FLAME_TX, FLAME_TY, WAX_FIELD_PATH, WAX_OUTER_PATH } from '../lib/waxShape.ts'

// The pledge wax seal — the brand's signature mark as a pressed-in wax medallion: an organic
// hand-poured edge with inner-shadow shading and the flame at the floor of the well. Static,
// it's the seal on the pledge ticket; with `ceremony`, it plays the "pour-then-press" commit
// beat (a blank wax patch drops in and STAYS, then the stamp presses the mark into it).
//
// Self-contained (each instance carries its own <defs>; never more than one seal on screen).
// The geometry lives in lib/waxShape.ts (seed 7) so it matches the canvas share card and the
// app icon exactly.

// Gradients + inner-shadow filters, verbatim from the blessed seal study — kept as markup and
// injected so the shading stays byte-identical to what was visually approved. `wseal-pit` is the
// recess (dark under the overhanging rim, light on the far wall); `wseal-sink` seats the flame.
const DEFS = `
<linearGradient id="wseal-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2401a"/><stop offset=".55" stop-color="#e42a06"/><stop offset="1" stop-color="#bf2004"/></linearGradient>
<linearGradient id="wseal-field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cb2505"/><stop offset="1" stop-color="#d72807"/></linearGradient>
<filter id="wseal-pit" x="-40%" y="-40%" width="180%" height="180%">
  <feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
  <feGaussianBlur in="inv" stdDeviation="8" result="ib"/>
  <feOffset in="ib" dy="6" result="ibt"/>
  <feFlood flood-color="#7c1502" flood-opacity=".5" result="dc"/>
  <feComposite in="dc" in2="ibt" operator="in" result="ts0"/>
  <feComposite in="ts0" in2="SourceAlpha" operator="in" result="topShadow"/>
  <feOffset in="ib" dy="-5" result="ibb"/>
  <feFlood flood-color="#ff8c62" flood-opacity=".3" result="lc"/>
  <feComposite in="lc" in2="ibb" operator="in" result="bl0"/>
  <feComposite in="bl0" in2="SourceAlpha" operator="in" result="botLight"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="botLight"/><feMergeNode in="topShadow"/></feMerge>
</filter>
<filter id="wseal-sink" x="-50%" y="-55%" width="200%" height="210%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/>
  <feOffset in="b" dy="-1.5" result="bo"/>
  <feFlood flood-color="#5c0f00" flood-opacity=".32" result="c"/>
  <feComposite in="c" in2="bo" operator="in" result="halo"/>
  <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
`

export function WaxSeal({
  ceremony = false,
  twist = 0,
  className = '',
}: {
  /** Play the pour-then-press commit animation on mount (else a static seal). */
  ceremony?: boolean
  /** Whole-seal rotation in degrees — applied seals rest slightly clockwise (~15°). */
  twist?: number
  className?: string
}) {
  const [run, setRun] = useState(false)
  useEffect(() => {
    if (!ceremony) return
    const id = requestAnimationFrame(() => setRun(true))
    return () => cancelAnimationFrame(id)
  }, [ceremony])

  return (
    <div
      className={`wseal${ceremony ? ' wseal--ceremony' : ''}${run ? ' wseal--run' : ''}${className ? ' ' + className : ''}`}
      aria-hidden="true"
    >
      <div className="wseal-dust" />
      <div className="wseal-rot" style={{ transform: `rotate(${twist}deg)` }}>
        <svg viewBox="0 0 512 512">
          <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
          <g className="wseal-body">
            <g className="wseal-pool">
              <path d={WAX_OUTER_PATH} fill="url(#wseal-top)" />
              <path d={WAX_OUTER_PATH} fill="none" stroke="#7d1400" strokeWidth={2.5} opacity={0.4} />
            </g>
            <path className="wseal-field" d={WAX_FIELD_PATH} fill="url(#wseal-field)" filter="url(#wseal-pit)" />
          </g>
          <g className="wseal-emblem">
            <g filter="url(#wseal-sink)">
              <g transform={`translate(${FLAME_TX},${FLAME_TY}) scale(${FLAME_SCALE})`}>
                <path d={FLAME_PATH} fill="#fbf6ec" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  )
}
