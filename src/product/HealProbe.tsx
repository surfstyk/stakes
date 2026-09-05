import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { appendHealLog, clearHealLog, startResumeHeal, type HealLogEntry } from '../lib/resumeHeal.ts'

// ?heal — the on-device diagnostic for the Nimiq Pay resume-freeze (nimiq/developer-center#209).
//
// Step 1 (observe): ?heal logs every lifecycle event to answer whether our JS receives resume
// signals inside the frozen composite. Proven on-device 2026-09-05 that it DOES — JS stays alive
// and the DOM keeps repainting while frozen (a native input/z-order bug, not a JS suspension).
//
// Step 2 (self-heal): ?selfheal adds an automatic, state-preserving location.reload() on the first
// foreground signal after a real background — the workaround under test. `reload` toggles it.
//
// The catch on iOS: navigator.vibrate is a no-op in WKWebView, AND if the frozen composite were a
// static snapshot the counter wouldn't repaint. So the DECISIVE record is the PERSISTED, timestamped
// log (survives force-quit → reopen): tap Copy and read whether resume entries land during the
// frozen window. Dev-only: mounted behind DEV_TOOLS, so it's tree-shaken out of the public build.

const MAX_VISIBLE = 14

function fmt(t: number): string {
  const d = new Date(t)
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}
function isResumeType(e: { type: string; vis: string }): boolean {
  return e.type === 'focus' || e.type === 'pageshow' || e.type === 'resume' || (e.type === 'visibilitychange' && e.vis === 'visible')
}

export function HealProbe({ reload = false }: { reload?: boolean }) {
  // Load prior sessions' log and append a BOOT marker so each open is visible in the record —
  // any resume entry stamped between the PREVIOUS boot and this one is proof JS ran while frozen.
  const [entries, setEntries] = useState<HealLogEntry[]>(() =>
    appendHealLog({ type: 'BOOT', vis: document.visibilityState, at: Date.now() }),
  )
  const [now, setNow] = useState(() => Date.now())
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const bootAt = useRef(Date.now())

  // Live clock: if this keeps ticking after you return from the background, the render thread is
  // alive; if it's frozen at the pre-background time, the composite is a static snapshot.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return startResumeHeal({
      reload,
      onEvent: (entry, log) => {
        // Best-effort haptic on a "we're back" signal. Android may buzz; iOS WKWebView ignores it.
        if (isResumeType(entry) && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(150)
          } catch {
            /* ignore */
          }
        }
        setEntries(log)
      },
    })
  }, [reload])

  const sinceBoot = entries.filter((e) => e.at >= bootAt.current)
  const resumes = sinceBoot.filter(isResumeType).length
  const last = entries[entries.length - 1]
  const sinceLast = last ? Math.max(0, Math.round((now - last.at) / 1000)) : 0

  async function copy() {
    const text =
      `stakes ?${reload ? 'selfheal' : 'heal'} log — copied ${fmt(now)} (${entries.length} entries, resumes this session ${resumes})\n` +
      entries.map((e) => `${fmt(e.at)}  ${e.type}${e.persisted ? '·persisted' : ''}  vis=${e.vis}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (no gesture / WKWebView) — dump to console so it's still recoverable.
      console.log(text)
      setCopied(false)
    }
  }
  function clear() {
    clearHealLog()
    setEntries([])
    bootAt.current = Date.now()
  }

  const S = styles
  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>{reload ? '?selfheal · #209 auto-reload' : '?heal · #209 probe'}</span>
        <button style={S.link} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'hide log ▾' : 'show log ▸'}
        </button>
      </div>

      <div style={S.metrics}>
        <div style={S.metric}>
          <div style={S.big}>{resumes}</div>
          <div style={S.label}>resumes (session)</div>
        </div>
        <div style={S.metric}>
          <div style={S.big}>{entries.length}</div>
          <div style={S.label}>events (all)</div>
        </div>
        <div style={S.metric}>
          <div style={S.clock}>{fmt(now)}</div>
          <div style={S.label}>live clock</div>
        </div>
      </div>

      <div style={S.lastline}>last: {last ? `${last.type} · vis=${last.vis} · ${sinceLast}s ago` : '—'}</div>

      {expanded && (
        <div style={S.log}>
          {entries
            .slice(-MAX_VISIBLE)
            .reverse()
            .map((e, i) => (
              <div
                key={`${e.at}-${i}`}
                style={{ ...S.row, ...(e.type === 'BOOT' || e.type === 'RELOAD' ? S.boot : null), ...(isResumeType(e) ? S.resume : null) }}
              >
                <span style={S.time}>{fmt(e.at)}</span>
                <span style={S.type}>
                  {e.type}
                  {e.persisted ? '·p' : ''}
                </span>
                <span style={S.vis}>{e.vis}</span>
              </div>
            ))}
        </div>
      )}

      <div style={S.actions}>
        <button style={S.btn} onClick={() => void copy()}>
          {copied ? 'copied ✓' : 'copy log'}
        </button>
        <button style={S.btn} onClick={clear}>
          clear
        </button>
      </div>
    </div>
  )
}

// Self-contained inline styles — the probe must render legibly regardless of app CSS/theme.
const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2147483647,
    maxHeight: '46vh',
    overflowY: 'auto',
    background: 'rgba(8,10,12,0.94)',
    color: '#c8facc',
    font: `12px/1.35 ${mono}`,
    paddingTop: 'calc(8px + env(safe-area-inset-top))',
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 10,
    boxShadow: '0 2px 14px rgba(0,0,0,0.5)',
    WebkitUserSelect: 'text',
    userSelect: 'text',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: '#8be9fd', fontWeight: 700, letterSpacing: 0.3 },
  link: { background: 'none', border: 'none', color: '#8be9fd', font: `12px ${mono}`, padding: 0 },
  metrics: { display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 4 },
  metric: { textAlign: 'center' },
  big: { fontSize: 30, fontWeight: 800, lineHeight: 1, color: '#50fa7b' },
  clock: { fontSize: 18, fontWeight: 700, lineHeight: 1.4, color: '#f1fa8c' },
  label: { fontSize: 10, opacity: 0.7, marginTop: 2 },
  lastline: { fontSize: 11, opacity: 0.85, margin: '2px 0 6px' },
  log: {
    borderTop: '1px solid rgba(255,255,255,0.12)',
    paddingTop: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  row: { display: 'flex', gap: 8, whiteSpace: 'nowrap' },
  time: { color: '#9aa0a6', minWidth: 92 },
  type: { minWidth: 118, fontWeight: 600 },
  vis: { opacity: 0.7 },
  resume: { color: '#50fa7b' },
  boot: { color: '#ff9ac1', fontWeight: 700 },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#e6f1ff',
    font: `12px ${mono}`,
    padding: '7px 0',
    borderRadius: 6,
  },
}
