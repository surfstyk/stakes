import { motion, type Variants } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { PledgeTicket, type TicketData } from './PledgeTicket.tsx'

// First-run hero: the <60s first impression. Leads with the ARTIFACT (a real pledge
// ticket that drops in and stamps itself) rather than explaining — show, don't tell.
// The concept then reads in one glance via a compact Pledge → Show up → Get it back
// strip. Shown once (see App + store.hasSeenWelcome); deeplink arrivals never see it.

const rise: Variants = {
  hide: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
}

// A sample pledge so a newcomer meets the star artifact immediately.
const SAMPLE: TicketData = {
  id: 'welcome-sample',
  emoji: '🏃',
  goal: 'running every morning',
  durationDays: 7,
  stake: 100,
  asset: 'NIM',
  creatorName: 'Alex',
  createdAt: Date.now(),
}

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const w = copy.welcome
  return (
    <motion.div
      className="welcome welcome-v2"
      initial="hide"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
    >
      <motion.span className="s-wordmark welcome-mark" variants={rise}>
        {brand.hasDot && <span className="dot" />} {brand.name}
      </motion.span>

      {/* the artifact — drops in on arrival. No seal: nothing's been pledged yet. */}
      <div className="welcome-stage">
        <PledgeTicket rec={SAMPLE} sealed={false} />
      </div>

      <motion.p className="s-kicker welcome-kicker" variants={rise}>
        {w.kicker}
      </motion.p>
      <motion.h1 className="s-h1 welcome-h1" variants={rise}>
        <span className="hook-h1-lead">{w.headline.lead}</span>
        <em>{w.headline.em}</em>
      </motion.h1>

      {/* the loop, in one glance */}
      <motion.div className="welcome-loop" variants={rise} aria-label="How it works">
        {w.steps.flatMap((s, i) => {
          const step = (
            <span className="loop-step" key={`s${i}`}>
              <span className="le">{s.emoji}</span>
              <span className="ll">{s.title}</span>
            </span>
          )
          return i === 0 ? [step] : [<span className="loop-arrow" key={`a${i}`}>→</span>, step]
        })}
      </motion.div>

      <motion.button className="s-cta welcome-cta" variants={rise} onClick={onStart}>
        {w.cta}
      </motion.button>
      <motion.p className="welcome-foot" variants={rise}>
        {w.foot}
      </motion.p>
    </motion.div>
  )
}
