import { motion, type Variants } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'

// First-run hero: the <60s first impression. Communicates the concept (stake → show
// up → get it back, kept honest by friends) and funnels into one action. Shown once
// (see App + store.hasSeenWelcome); deeplink arrivals never see it.

const rise: Variants = {
  hide: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
}

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const w = copy.welcome
  return (
    <motion.div
      className="welcome"
      initial="hide"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
    >
      <motion.span className="s-wordmark welcome-mark" variants={rise}>
        {brand.hasDot && <span className="dot" />} {brand.name}
      </motion.span>

      <motion.p className="s-kicker welcome-kicker" variants={rise}>
        {w.kicker}
      </motion.p>
      <motion.div variants={rise}>
        <Headline h={w.headline} className="s-h1 welcome-h1" />
      </motion.div>
      <motion.p className="s-sub welcome-sub" variants={rise}>
        {w.sub}
      </motion.p>

      <div className="welcome-steps">
        {w.steps.map((s, i) => (
          <motion.div className="welcome-step" key={i} variants={rise}>
            <span className="ws-emoji">{s.emoji}</span>
            <div>
              <div className="ws-title">{s.title}</div>
              <div className="ws-text">{s.text}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button className="s-cta welcome-cta" variants={rise} onClick={onStart}>
        {w.cta}
      </motion.button>
      <motion.p className="welcome-foot" variants={rise}>
        {w.foot}
      </motion.p>
    </motion.div>
  )
}
