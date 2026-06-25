import { motion } from 'motion/react'
import { copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { ShareComposer } from '../share/index.ts'
import type { PledgeCardData } from '../share/index.ts'
import { getChallenge } from './store.ts'

// The post-create "share your pledge" moment, as its own URL-backed screen (?s=<id>).
// Being addressable is the point: the WebView can reload (iOS does this after the
// image save/context-switch) and still restore here instead of dumping the user home.

export function PledgeShareScreen({
  challengeId,
  onEnter,
  onOpenJoin,
  onCreate,
}: {
  challengeId: string
  onEnter: (id: string) => void
  onOpenJoin: (id: string) => void
  onCreate: () => void
}) {
  const rec = getChallenge(challengeId)
  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <h1 className="s-h1">{copy.progress.notFoundH1}</h1>
        <button className="s-cta" onClick={onCreate}>
          {copy.progress.notFoundCta}
        </button>
      </div>
    )
  }

  const shareUrl = `${location.origin}${location.pathname}?c=${rec.id}`
  const cardData: PledgeCardData = {
    kind: 'pledge',
    emoji: rec.emoji,
    goal: rec.goal,
    durationDays: rec.durationDays,
    stake: rec.stake,
    asset: rec.asset,
    creatorName: rec.creatorName,
    whosIn: rec.participants.map((p) => p.name),
  }
  const shareText = copy.share.pledge(rec.emoji, rec.goal, rec.durationDays, rec.stake, rec.asset)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="s-kicker">{copy.pledged.kicker}</p>
      <Headline h={copy.pledged.h1} className="s-h1 s-h1-tight" />

      <ShareComposer data={cardData} cta={copy.pledged.share} shareText={shareText} shareUrl={shareUrl} />

      <div className="s-share-nav">
        <button className="s-link" onClick={() => onOpenJoin(rec.id)}>
          {copy.pledged.preview}
        </button>
        <button className="s-link" onClick={() => onEnter(rec.id)}>
          {copy.pledged.goChallenge}
        </button>
      </div>
    </motion.div>
  )
}
