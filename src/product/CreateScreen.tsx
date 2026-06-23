import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { Asset } from '../vault/types.ts'
import { PledgeCard } from './PledgeCard.tsx'
import {
  TEMPLATES,
  WINDOW_PRESETS,
  createChallenge,
  seedDemoFriends,
  type ChallengeRecord,
  type WindowPreset,
} from './store.ts'

const STEP: Record<Asset, number> = { NIM: 25, USDT: 1 }
const MIN: Record<Asset, number> = { NIM: 25, USDT: 1 }
const DEFAULT_STAKE: Record<Asset, number> = { NIM: 100, USDT: 5 }

export function CreateScreen({ onOpenJoin }: { onOpenJoin: (id: string) => void }) {
  const [templateId, setTemplateId] = useState('run')
  const [customGoal, setCustomGoal] = useState('')
  const [name, setName] = useState('')
  const [days, setDays] = useState(7)
  const asset: Asset = 'NIM' // Cycle-I money layer is custodial-NIM (locked 2026-06-23)
  const [stake, setStake] = useState(DEFAULT_STAKE.NIM)
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('tomorrow')
  const [created, setCreated] = useState<ChallengeRecord | null>(null)
  const [copied, setCopied] = useState(false)

  const template = TEMPLATES.find((t) => t.id === templateId)!
  const isCustom = templateId === 'custom'
  const goal = isCustom ? customGoal.trim() : template.goal
  const canCreate = goal.length > 1

  const shareUrl = useMemo(
    () => (created ? `${location.origin}${location.pathname}?c=${created.id}` : ''),
    [created],
  )

  function create() {
    const rec = createChallenge({
      templateId,
      goal,
      emoji: template.emoji,
      durationDays: days,
      stake,
      asset,
      creatorName: name.trim() || 'You',
      window: windowPreset,
    })
    seedDemoFriends(rec.id) // demo: so "who's in" isn't empty for the friend who taps the link
    setCreated(rec)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function share() {
    const text = `${template.emoji} I'm ${goal} for ${days} days, ${stake} ${asset} on the line. Watch me 👀`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Stakes', text, url: shareUrl })
        return
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  // ---- Created → share the pledge ----
  if (created) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="s-kicker">Your pledge is live</p>
        <h1 className="s-h1">
          Now go <em>post it.</em>
        </h1>
        <p className="s-sub">The first friend who taps in starts your week. This card is the invite.</p>

        <motion.div
          initial={{ opacity: 0, y: 16, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <PledgeCard
            emoji={created.emoji}
            goal={created.goal}
            durationDays={created.durationDays}
            stake={created.stake}
            asset={created.asset}
            creatorName={created.creatorName}
          />
        </motion.div>

        <div className="s-spacer" />
        <button className="s-cta" onClick={share}>
          {copied ? 'Link copied ✓' : 'Share to your story'}
        </button>
        <div className="s-spacer" />
        <button className="s-ghost" onClick={() => onOpenJoin(created.id)}>
          Preview the join screen →
        </button>
        <p className="s-foothint">This is what your friends will see when they tap your link.</p>
      </motion.div>
    )
  }

  // ---- Create form ----
  return (
    <div>
      <p className="s-kicker">New challenge</p>
      <h1 className="s-h1">
        What are you <em>committing</em> to?
      </h1>
      <p className="s-sub">Stake a little on a goal. Do it daily. Your crew keeps you honest.</p>

      <div className="s-templates">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="s-chip"
            data-on={t.id === templateId}
            onClick={() => setTemplateId(t.id)}
          >
            <span className="emoji">{t.emoji}</span>
            <span>
              <span className="ct">{t.label}</span>
              <br />
              <span className="cs">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {isCustom && (
        <>
          <p className="s-label">Your goal</p>
          <input
            className="s-field"
            placeholder="e.g. write 500 words"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            maxLength={42}
          />
        </>
      )}

      <p className="s-label">For how long?</p>
      <div className="s-stake-row">
        <button className="s-step" onClick={() => setDays((d) => Math.max(3, d - 1))} aria-label="fewer days">
          −
        </button>
        <div className="s-stake-amt" style={{ justifyContent: 'center' }}>
          <span className="num">{days}</span>
          <span className="cur">days</span>
        </div>
        <button className="s-step" onClick={() => setDays((d) => Math.min(30, d + 1))} aria-label="more days">
          +
        </button>
      </div>

      <p className="s-label">The stake</p>
      <p className="s-note">Staked in NIM. Gasless and instant, and you get it all back if you finish.</p>
      <div className="s-stake-row">
        <div className="s-stake-amt">
          <span className="num">{stake}</span>
          <span className="cur">{asset}</span>
        </div>
        <button
          className="s-step"
          onClick={() => setStake((s) => Math.max(MIN[asset], s - STEP[asset]))}
          aria-label="lower stake"
        >
          −
        </button>
        <button className="s-step" onClick={() => setStake((s) => s + STEP[asset])} aria-label="raise stake">
          +
        </button>
      </div>

      <p className="s-label">Doors close…</p>
      <div className="s-seg">
        {WINDOW_PRESETS.map((w) => (
          <button key={w.id} data-on={w.id === windowPreset} onClick={() => setWindowPreset(w.id)}>
            {w.label}
            <small>{w.sub}</small>
          </button>
        ))}
      </div>

      <p className="s-label">Sign it as</p>
      <input
        className="s-field"
        placeholder="your first name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={18}
      />

      <div className="s-sticky">
        <button className="s-cta" disabled={!canCreate} onClick={create}>
          Make the pledge →
        </button>
      </div>
    </div>
  )
}
