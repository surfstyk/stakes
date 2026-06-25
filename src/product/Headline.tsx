import type { Headline as HeadlineCopy } from '../brand/index.ts'

/** Renders an accented headline: {lead}<em>{em}</em>{tail}. Voice lives in copy.ts. */
export function Headline({ h, className = 's-h1' }: { h: HeadlineCopy; className?: string }) {
  return (
    <h1 className={className}>
      {h.lead}
      <em>{h.em}</em>
      {h.tail}
    </h1>
  )
}
