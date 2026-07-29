import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { brand, copy } from '../brand/index.ts'
import { Headline } from './Headline.tsx'
import { Loading } from './Loading.tsx'
import { PledgeTicket } from './PledgeTicket.tsx'
import {
  avatarColor,
  getChallenge,
  getMyName,
  initials,
  joinChallenge,
  type ChallengeRecord,
} from './store.ts'

/** Compact countdown: "6h 23m" while hours remain, "04m 12s" inside the last hour. */
function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

function useCountdown(target: number): { text: string; over: boolean } {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = target - now
  return { text: fmtLeft(ms), over: ms <= 0 }
}

function Avatars({ names, extraLabel = true }: { names: string[]; extraLabel?: boolean }) {
  const shown = names.slice(0, 4)
  const extra = names.length - shown.length
  return (
    <div className="s-avatars">
      {shown.map((n, i) => (
        <span key={i} className="s-av" style={{ background: avatarColor(n) }}>
          {initials(n)}
        </span>
      ))}
      {extraLabel && extra > 0 && <span className="s-av more">+{extra}</span>}
    </div>
  )
}

/** Did the user back out (declined the wallet dialog / dismissed a sheet), vs a real failure? */
function isUserCancel(e: unknown): boolean {
  const err = e as { name?: string; message?: string }
  return err?.name === 'AbortError' || /cancel|declin|reject|denied|abort/i.test(err?.message ?? '')
}

function whosInLine(names: string[]): string {
  if (names.length === 0) return '' // defensive: a 0-participant challenge must never render "undefined…"
  if (names.length === 1) return copy.join.whosInOne(names[0])
  if (names.length === 2) return copy.join.whosInTwo(names[0], names[1])
  return copy.join.whosInMany(names[0], names[1], names.length - 2)
}

/**
 * Send the invite. Returns `true` only when we fell back to copying the link to the
 * clipboard — so the caller can surface a "copied ✓" confirmation. The native share sheet
 * (and a user cancel) provide their own feedback, so those return `false`.
 */
async function shareInvite(rec: ChallengeRecord): Promise<boolean> {
  const url = `${location.origin}${location.pathname}?c=${rec.id}`
  const text = copy.share.joined(rec.creatorName, rec.emoji)
  if (navigator.share) {
    try {
      await navigator.share({ title: brand.name, text, url })
      return false // native sheet handled it — no in-app confirmation needed
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return false // user cancelled
      /* unsupported → fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}

export function JoinScreen({
  challengeId,
  onCreateOwn,
  onEnter,
}: {
  challengeId: string
  onCreateOwn: () => void
  onEnter: (id: string) => void
}) {
  const [rec, setRec] = useState<ChallengeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  // Pre-fill from a prior session; only ask for a name if we don't already know one.
  const known = getMyName()
  const [name, setName] = useState(known === 'You' ? '' : known)
  const askName = known === 'You'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [pulled, setPulled] = useState(false) // "invite link copied" confirmation
  const countdown = useCountdown(rec?.lockAt ?? 0)

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

  // ---- challenge not found ----
  if (!rec) {
    return (
      <div className="s-center" style={{ paddingTop: 40 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }} aria-hidden="true">
          🤷
        </div>
        <h1 className="s-h1">{copy.join.notFoundH1}</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {copy.join.notFoundSub}
        </p>
        <button className="s-cta" onClick={onCreateOwn}>
          {copy.join.notFoundCta}
        </button>
      </div>
    )
  }

  const names = rec.participants.map((p) => p.name)

  // ---- joined confirmation ("you're in") ----
  if (joined) {
    return (
      <section className="confirm">
        <div className="confirm-seal-stage">
          <div className="confirm-dust" aria-hidden="true" />
          <div className="big-seal" aria-hidden="true">
            <span className="e">{copy.cards.pledgeStamp}</span>
            <span className="t">{copy.cards.lockedIn}</span>
          </div>
        </div>

        <p className="confirm-kick reveal d1" style={{ color: 'var(--go)' }}>
          {copy.join.joinedKicker}
        </p>
        <Headline h={copy.join.joinedH1} className="s-h1 s-h1-go confirm-h1 reveal d1" />
        <p className="s-sub reveal d2" style={{ margin: '12px auto 0', textAlign: 'center' }}>
          {copy.join.joinedSub(rec.stake, rec.asset)}
        </p>

        <div className="crew-line reveal d3">
          <Avatars names={names} extraLabel={false} />
          <span className="txt">{copy.join.youMake(names.length)}</span>
        </div>

        <div className="reshare-card reveal d4">
          <div className="quote">“{copy.join.reshareQuote}”</div>
        </div>

        <div className="s-sticky">
          <button
            className="s-cta s-cta--share"
            onClick={async () => {
              if (await shareInvite(rec)) setPulled(true)
            }}
          >
            <ShareIcon />
            {pulled ? copy.join.pullFriendCopied : copy.join.pullFriend}
          </button>
          <button className="later" onClick={() => onEnter(rec.id)}>
            {copy.join.later}
          </button>
        </div>
      </section>
    )
  }

  // ---- doors closed (never dead-end) ----
  if (countdown.over) {
    return (
      <div className="s-center" style={{ paddingTop: 28 }}>
        <div className="pledge-emoji" style={{ fontSize: 48 }} aria-hidden="true">
          🚪
        </div>
        <h1 className="s-h1">{copy.join.closedH1}</h1>
        <p className="s-sub" style={{ margin: '0 auto 22px' }}>
          {copy.join.closedSub(rec.creatorName, rec.emoji)}
        </p>
        <button className="s-cta" onClick={onCreateOwn}>
          {copy.join.closedCta}
        </button>
        <div className="s-spacer" />
        <p className="s-foothint">{copy.join.closedFoot(whosInLine(names))}</p>
      </div>
    )
  }

  // ---- join offer ----
  async function join() {
    setBusy(true)
    setErr(null)
    try {
      const updated = await joinChallenge(rec!.id, name.trim() || 'You')
      setRec(updated)
      setJoined(true)
    } catch (e) {
      // Don't fail silently at the single highest-anxiety moment in the funnel (UX-02):
      // a gentle nudge if they backed out of the wallet, the real reason otherwise.
      setErr(isUserCancel(e) ? copy.join.errCancel : (e as Error).message || copy.join.errFallback)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* the hook */}
      <div className="hook">
        <div className="darer">
          <span className="face" style={{ background: avatarColor(rec.creatorName) }}>
            {initials(rec.creatorName)}
          </span>
          <span className="kick">{copy.join.kickerDared(rec.creatorName)}</span>
        </div>
        <h1 className="s-h1 hook-h1">
          <span className="hook-h1-lead">{copy.join.h1Lead}</span>
          {copy.join.h1.lead}
          <em>{copy.join.h1.em}</em>
          {copy.join.h1.tail}
        </h1>
        <p className="s-sub hook-sub">{copy.join.sub}</p>
      </div>

      {/* social proof — loud, high (only once someone's actually in) */}
      {names.length > 0 && (
        <div className="proof">
          <Avatars names={names} />
          <div className="proof-txt">
            {whosInLine(names)}
            <span>{copy.join.crewRunning}</span>
          </div>
        </div>
      )}

      {/* the clock — the engine, the one vermilion thing */}
      <div className="clock" role="timer" aria-label={`${copy.join.countdown} ${countdown.text}`}>
        <span className="dot" />
        <span className="clock-lbl">{copy.join.countdown}</span>
        <span className="clock-time">{countdown.text}</span>
      </div>

      {/* the real artifact — continuity with the shared card */}
      <div className="stage">
        <PledgeTicket rec={rec} />
      </div>

      <p className="fine">{copy.join.heldSafe(rec.stake, rec.asset)}</p>

      {askName && (
        <>
          <p className="s-label">{copy.join.nameLabel}</p>
          <input
            className="s-field"
            placeholder={copy.join.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={18}
          />
        </>
      )}

      <div className="s-sticky">
        <div className="clock-echo" aria-hidden="true">
          <span className="dot" />
          {copy.join.countdown} <span>{countdown.text}</span>
        </div>
        {err && (
          <p className="s-foothint" role="alert" style={{ color: 'var(--stake)' }}>
            {err}
          </p>
        )}
        <button
          className="s-cta"
          data-variant="go"
          disabled={busy || (askName && !name.trim())}
          onClick={join}
        >
          {busy ? copy.join.ctaBusy : copy.join.cta(rec.stake, rec.asset)}
        </button>
        <div className="join-meta">
          <ShieldCheck />
          {copy.join.guarantee}
        </div>
        <button className="s-link join-exit" onClick={onCreateOwn}>
          {copy.join.offerExit}
        </button>
      </div>
    </motion.div>
  )
}

function ShareIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M12 3L7.5 7.5M12 3l4.5 4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function ShieldCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 3v6c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V5l7-3z" stroke="var(--ink-soft)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 11.5l2 2 4-4.5" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
