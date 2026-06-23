import type { Asset } from '../vault/types.ts'
import { avatarColor, initials } from './store.ts'

export interface PledgeCardProps {
  emoji: string
  goal: string
  durationDays: number
  stake: number
  asset: Asset
  creatorName: string
}

// The shareable hero artifact — designed to be screenshotted and posted.
export function PledgeCard({ emoji, goal, durationDays, stake, asset, creatorName }: PledgeCardProps) {
  return (
    <div className="pledge">
      <div className="pledge-head">
        <span className="brand">Stakes</span>
        <span className="meta">The Pledge</span>
      </div>

      <div className="pledge-emoji">{emoji}</div>
      <h2 className="pledge-goal">
        I'm <em>{goal || 'doing the thing'}</em> for {durationDays} days.
      </h2>

      <div className="pledge-stake">
        <span className="amt">
          {stake} {asset}
        </span>{' '}
        <span className="lbl">on the line</span>
      </div>

      <div className="pledge-stamp">
        PLEDGED
        <small>WATCH ME</small>
      </div>

      <div className="pledge-perf">
        <span className="notch l" />
        <span className="notch r" />
      </div>

      <div className="pledge-foot">
        <span className="who">
          <span
            className="s-av"
            style={{
              background: avatarColor(creatorName),
              width: 28,
              height: 28,
              fontSize: 12,
              marginLeft: 0,
            }}
          >
            {initials(creatorName)}
          </span>
          {creatorName}
        </span>
        <span className="watch">hold me to it 🤞</span>
      </div>
    </div>
  )
}
