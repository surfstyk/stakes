import { useState } from 'react'
import type { Asset } from '../vault/types.ts'
import { copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import {
  TEMPLATES,
  WINDOW_PRESETS,
  createChallenge,
  deleteChallenge,
  isTestMode,
  joinChallenge,
  myChallenges,
  seedDemoFriends,
  type WindowPreset,
} from './store.ts'

const STEP: Record<Asset, number> = { NIM: 25, USDT: 1 }
const MIN: Record<Asset, number> = { NIM: 25, USDT: 1 }
const DEFAULT_STAKE: Record<Asset, number> = { NIM: 100, USDT: 5 }

export function CreateScreen({
  onShare,
  onEnter,
}: {
  onShare: (id: string) => void
  onEnter: (id: string) => void
}) {
  const [templateId, setTemplateId] = useState('run')
  const [customGoal, setCustomGoal] = useState('')
  const [name, setName] = useState('')
  const [days, setDays] = useState(7)
  const asset: Asset = 'NIM' // Cycle-I money layer is custodial-NIM (locked 2026-06-23)
  const [stake, setStake] = useState(DEFAULT_STAKE.NIM)
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('tomorrow')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const template = TEMPLATES.find((t) => t.id === templateId)!
  const isCustom = templateId === 'custom'
  const goal = isCustom ? customGoal.trim() : template.goal
  const canCreate = goal.length > 1

  async function create() {
    if (busy) return
    setBusy(true)
    setErr(null)
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
    try {
      // The creator commits their own stake too — same path as any joiner.
      await joinChallenge(rec.id, rec.creatorName)
      seedDemoFriends(rec.id) // demo: so "who's in" isn't empty when a friend taps the link
      // Hand off to the URL-backed share screen so a WebView reload can restore it.
      onShare(rec.id)
    } catch (e) {
      deleteChallenge(rec.id) // roll back the orphan if the stake was declined
      setErr((e as Error).message || copy.create.errFallback)
    } finally {
      setBusy(false)
    }
  }

  // ---- Create form ----
  const resumable = myChallenges()[0] ?? null
  return (
    <div>
      {resumable && (
        <button className="s-resume" onClick={() => onEnter(resumable.id)}>
          <span>
            {resumable.emoji} {resumable.goal}
          </span>
          <span className="go">{copy.create.resumeGo}</span>
        </button>
      )}
      <p className="s-kicker">{copy.create.kicker}</p>
      <Headline h={copy.create.h1} />
      <p className="s-sub">{copy.create.sub}</p>

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
          <p className="s-label">{copy.create.customLabel}</p>
          <input
            className="s-field"
            placeholder={copy.create.customPlaceholder}
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            maxLength={42}
          />
        </>
      )}

      <p className="s-label">{copy.create.durationLabel}</p>
      <div className="s-stake-row">
        <button className="s-step" onClick={() => setDays((d) => Math.max(3, d - 1))} aria-label="fewer days">
          −
        </button>
        <div className="s-stake-amt" style={{ justifyContent: 'center' }}>
          <span className="num">{days}</span>
          <span className="cur">{copy.create.daysUnit}</span>
        </div>
        <button className="s-step" onClick={() => setDays((d) => Math.min(30, d + 1))} aria-label="more days">
          +
        </button>
      </div>

      <p className="s-label">{copy.create.stakeLabel}</p>
      <p className="s-note">{copy.create.stakeNote}</p>
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

      <p className="s-label">{copy.create.windowLabel}</p>
      <div className="s-seg">
        {WINDOW_PRESETS.map((w) => (
          <button key={w.id} data-on={w.id === windowPreset} onClick={() => setWindowPreset(w.id)}>
            {w.label}
            <small>{w.sub}</small>
          </button>
        ))}
      </div>
      {isTestMode() && (
        <p className="s-note" style={{ color: 'var(--stake)' }}>
          {copy.create.testWindowNote}
        </p>
      )}

      <p className="s-label">{copy.create.nameLabel}</p>
      <input
        className="s-field"
        placeholder={copy.create.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={18}
      />

      <div className="s-sticky">
        {err && (
          <p className="s-foothint" style={{ color: 'var(--stake)' }}>
            {err}
          </p>
        )}
        <button className="s-cta" disabled={!canCreate || busy} onClick={create}>
          {busy ? copy.create.ctaBusy : copy.create.cta(stake, asset)}
        </button>
      </div>
    </div>
  )
}
