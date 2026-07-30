import { useEffect, useRef, useState } from 'react'
import type { Asset } from '../vault/types.ts'
import { copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { PledgeTicket, type TicketData } from './PledgeTicket.tsx'
import { revealField } from './revealField.ts'
import {
  TEMPLATES,
  WINDOW_PRESETS,
  createChallenge,
  dayState,
  deleteChallenge,
  getChallenge,
  getMyName,
  isTestMode,
  joinChallenge,
  myChallenges,
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
  const [name, setName] = useState(() => {
    const n = getMyName()
    return n === 'You' ? '' : n // prefill from a prior session, but not the 'You' default
  })
  const [days, setDays] = useState(7)
  const asset: Asset = 'NIM' // Cycle-I money layer is custodial-NIM (locked 2026-06-23)
  const [stake, setStake] = useState(DEFAULT_STAKE.NIM)
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('tomorrow')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [needName, setNeedName] = useState(false)
  const [previewCreatedAt] = useState(() => Date.now())
  const goalRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const template = TEMPLATES.find((t) => t.id === templateId)!
  const isCustom = templateId === 'custom'
  const goal = isCustom ? customGoal.trim() : template.goal
  // A name is still required — it's the signature on the shared pledge card + the crew
  // avatar, so a blank "You" would degrade the artifact everyone else sees. But we no
  // longer DISABLE the CTA for it (the name field is last/below the fold, so a greyed-out
  // button was a mystery dead-end). Instead the button stays live and, on tap, guides the
  // user down to the empty field (see create()).
  const hasGoal = goal.length > 1
  const hasName = name.trim().length > 0

  // Live preview of the pledge being built — the artifact is the product, so show it
  // forming as you pick goal / stake / days (primes the share, "designing your pledge").
  const preview: TicketData = {
    id: 'preview',
    emoji: template.emoji,
    goal: goal || 'your goal here',
    durationDays: days,
    stake,
    asset,
    creatorName: name.trim() || 'You',
    createdAt: previewCreatedAt,
  }

  // Resume only a challenge that's still LIVE (not finished). The local breadcrumb is
  // state-blind, so verify against the backend — otherwise a finished challenge would
  // sit at the top forever. No live one → lead cleanly with the new-challenge flow.
  const [resumable, setResumable] = useState<{ id: string; emoji: string; goal: string } | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const m of myChallenges().slice(0, 6)) {
        const rec = await getChallenge(m.id)
        if (!rec) {
          deleteChallenge(m.id) // prune challenges that no longer exist
          continue
        }
        if (!dayState(rec).over) {
          if (alive) setResumable({ id: rec.id, emoji: rec.emoji, goal: rec.goal })
          return
        }
      }
      if (alive) setResumable(null)
    })()
    return () => {
      alive = false
    }
  }, [])

  async function create() {
    if (busy) return
    // The CTA is always live, so validate on tap and lead the user to the first empty
    // required field rather than silently doing nothing.
    if (!hasGoal) return revealField(goalRef)
    if (!hasName) {
      setNeedName(true)
      return revealField(nameRef)
    }
    setBusy(true)
    setErr(null)
    const creatorName = name.trim() || 'You'
    let id: string | null = null
    try {
      id = await createChallenge({
        templateId,
        goal,
        emoji: template.emoji,
        durationDays: days,
        stake,
        asset,
        creatorName,
        window: windowPreset,
      })
      // The creator commits their own stake too — same path as any joiner — so "who's
      // in" is real (the creator) the moment a friend taps the link. No seeded friends.
      await joinChallenge(id, creatorName)
      // Hand off to the URL-backed share screen so a WebView reload can restore it.
      onShare(id)
    } catch (e) {
      if (id) deleteChallenge(id) // roll back the local breadcrumb if the stake was declined
      setErr((e as Error).message || copy.create.errFallback)
    } finally {
      setBusy(false)
    }
  }

  // ---- Create form ----
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

      <div className="create-preview">
        <PledgeTicket rec={preview} />
      </div>

      <div className="s-templates" role="group" aria-label="Pick a goal">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="s-chip"
            data-on={t.id === templateId}
            aria-pressed={t.id === templateId}
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
          <label className="s-label" htmlFor="create-goal">
            {copy.create.customLabel}
          </label>
          <input
            ref={goalRef}
            id="create-goal"
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

      <p className="s-label" id="window-label">{copy.create.windowLabel}</p>
      <div className="s-seg" role="group" aria-labelledby="window-label">
        {WINDOW_PRESETS.map((w) => (
          <button
            key={w.id}
            data-on={w.id === windowPreset}
            aria-pressed={w.id === windowPreset}
            onClick={() => setWindowPreset(w.id)}
          >
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

      <label className="s-label" htmlFor="create-name">
        {copy.create.nameLabel}
      </label>
      <input
        ref={nameRef}
        id="create-name"
        className="s-field"
        placeholder={copy.create.namePlaceholder}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (needName) setNeedName(false)
        }}
        aria-invalid={needName && !hasName}
        maxLength={18}
      />
      {needName && !hasName && (
        <p className="s-fieldhint" role="alert">
          {copy.create.needName}
        </p>
      )}

      <div className="s-sticky">
        {err && (
          <p className="s-foothint" role="alert" style={{ color: 'var(--stake)' }}>
            {err}
          </p>
        )}
        <button className="s-cta" disabled={busy} onClick={create}>
          {busy ? copy.create.ctaBusy : copy.create.cta(stake, asset)}
        </button>
      </div>
    </div>
  )
}
