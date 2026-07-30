import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { Loading } from './Loading.tsx'
import { ShareComposer, copyText } from '../share/index.ts'
import type { PledgeCardData } from '../share/index.ts'
import { getChallenge, type ChallengeRecord } from './store.ts'

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
  const [rec, setRec] = useState<ChallengeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [invited, setInvited] = useState(false)

  useEffect(() => {
    let alive = true
    getChallenge(challengeId).then((r) => {
      if (!alive) return
      setRec(r)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [challengeId])

  if (loading) return <Loading />
  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <h1 className="s-h1">{copy.pledged.notFoundH1}</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {copy.pledged.notFoundSub}
        </p>
        <button className="s-cta" onClick={onCreate}>
          {copy.pledged.notFoundCta}
        </button>
      </div>
    )
  }

  const shareUrl = `${location.origin}${location.pathname}?c=${rec.id}`
  const cardData: PledgeCardData = {
    kind: 'pledge',
    id: rec.id,
    createdAt: rec.createdAt,
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
      <div className="hype">
        <div className="live-kicker">
          <span className="pulse" />
          {copy.pledged.kicker}
        </div>
        <Headline h={copy.pledged.h1} className="s-h1 s-h1-tight hype-h1" />
        <p className="s-sub hype-sub">{copy.pledged.sub}</p>
      </div>

      <ShareComposer data={cardData} cta={copy.pledged.share} shareText={shareText} shareUrl={shareUrl} />

      {/* secondary, demoted: send the join LINK instead (url-only → reliable on iOS, where
          attaching the card image drops the caption text), with a clipboard fallback. */}
      <div className="invite-row">
        <span>{copy.pledged.inviteLead}</span>
        <button
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: brand.name, text: shareText, url: shareUrl })
                return
              } catch (e) {
                if ((e as { name?: string })?.name === 'AbortError') return // user cancelled the sheet
              }
            }
            setInvited(await copyText(shareUrl))
          }}
        >
          {invited ? copy.pledged.inviteCopied : copy.pledged.invite}
          <CopyIcon />
        </button>
      </div>

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

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="var(--ink)" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 012-2h10" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
