import { motion } from 'motion/react'
import { theme } from '../brand/index.ts'

// A one-shot confetti burst for celebratory beats (perfect week). Dependency-free,
// pointer-events-none, plays once on mount. Tasteful, not a casino.

const COLORS = [theme.color.stake, theme.color.go, theme.color.gold, '#5ff0a8', '#2b6cb0']

export function Confetti({ count = 20 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.25
        const duration = 1.2 + Math.random() * 0.9
        const rotate = (Math.random() * 2 - 1) * 420
        const size = 7 + Math.random() * 6
        return (
          <motion.span
            key={i}
            className="confetti-piece"
            style={{ left: `${left}%`, width: size, height: size * 1.5, background: COLORS[i % COLORS.length] }}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: '108vh', opacity: [0, 1, 1, 0], rotate }}
            transition={{ duration, delay, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}
