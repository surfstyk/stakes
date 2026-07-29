import { useEffect, useRef, useState, type CSSProperties } from 'react'

// TEMPORARY on-device share diagnostic, reachable at ?diag (query-on-root, which Nimiq Pay
// forwards through the deeplink even on Android — unlike a sub-path like /sharetest.html).
// Rendered before the "Open in Nimiq Pay" gate so it always loads. Mirrors public/sharetest.html
// so results are comparable. Remove once the share flow is confirmed on both platforms.

const URL_ = 'https://stakes.surfstyk.com/?c=diagtest'
const TXT = 'Banked the week ✅ testing the share sheet.'

function pngFile(): File {
  const c = document.createElement('canvas')
  c.width = 540
  c.height = 960
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fbf6ec'
  ctx.fillRect(0, 0, 540, 960)
  ctx.fillStyle = '#0f7a44'
  ctx.font = '900 90px sans-serif'
  ctx.fillText('BANKED', 40, 430)
  const url = c.toDataURL('image/png')
  const bin = atob(url.split(',')[1])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([new Blob([bytes], { type: 'image/png' })], 'stakes.png', { type: 'image/png' })
}

export function ShareDiag() {
  const [lines, setLines] = useState<string[]>([])
  const fileRef = useRef<File | null>(null)
  const log = (m: string) =>
    setLines((ls) => [...ls, `[${new Date().toISOString().slice(11, 19)}] ${m}`])

  const nav = navigator as Navigator & {
    canShare?: (d?: ShareData) => boolean
    share?: (d?: ShareData) => Promise<void>
  }

  useEffect(() => {
    const f = (fileRef.current = pngFile())
    let files = false
    let txt = false
    try {
      files = !!(nav.canShare && nav.canShare({ files: [f] }))
    } catch {
      /* ignore */
    }
    try {
      txt = !!(nav.canShare && nav.canShare({ text: TXT, url: URL_ }))
    } catch {
      /* ignore */
    }
    const host = !!((window as { nimiqPay?: unknown }).nimiqPay || (window as { nimiq?: unknown }).nimiq)
    log(
      `probe: host=${host} share=${!!nav.share} canShareFiles=${files} canShareTxt=${txt} secure=${window.isSecureContext} UA=${navigator.userAgent}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shareImage = () => {
    const f = fileRef.current ?? pngFile()
    if (!nav.share) return log('1 image: navigator.share MISSING')
    if (nav.canShare && !nav.canShare({ files: [f] })) return log('1 image: canShare({files})=FALSE — WebView refuses image files')
    log('1 image: calling share({files})…')
    nav.share({ files: [f], text: TXT }).then(
      () => log('1 image: ✅ SHARED OK'),
      (e: { name?: string; message?: string }) => log(`1 image: ✗ ${e.name} — ${e.message}`),
    )
  }
  const shareText = () => {
    if (!nav.share) return log('2 text: navigator.share MISSING')
    log('2 text: calling share({text,url})…')
    nav.share({ text: TXT, url: URL_ }).then(
      () => log('2 text: ✅ SHARED OK'),
      (e: { name?: string; message?: string }) => log(`2 text: ✗ ${e.name} — ${e.message}`),
    )
  }
  const download = () => {
    try {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(fileRef.current ?? pngFile())
      a.download = 'stakes.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      log('3 download: click dispatched → did a file save, or nothing/opened a viewer?')
    } catch (e) {
      log(`3 download: ✗ ${(e as Error).message}`)
    }
  }
  const copy = () => {
    if (!navigator.clipboard?.writeText) return log('4 copy: clipboard MISSING')
    navigator.clipboard.writeText(URL_).then(
      () => log('4 copy: ✅ link copied'),
      (e: { message?: string }) => log(`4 copy: ✗ ${e.message}`),
    )
  }
  const copyLog = () => {
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => log('— log copied ✓ (paste to Hendrik)'),
      () => log('— copy failed; screenshot the log'),
    )
  }

  const S: Record<string, CSSProperties> = {
    wrap: { background: '#17130e', color: '#f3ece0', minHeight: '100vh', padding: 16, font: '15px/1.45 -apple-system, sans-serif' },
    btn: { display: 'block', width: '100%', margin: '8px 0', padding: 15, border: 0, borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#ef2d06', color: '#fff' },
    alt: { background: '#2e2820', color: '#f3ece0' },
    log: { background: '#0e0b08', border: '1px solid #2e2820', borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '45vh', overflow: 'auto' },
  }
  return (
    <div style={S.wrap}>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Stakes · share diagnostic (?diag)</h1>
      <button style={S.btn} onClick={shareImage}>1 · Share the image (file)</button>
      <button style={S.btn} onClick={shareText}>2 · Share text + link</button>
      <button style={{ ...S.btn, ...S.alt }} onClick={download}>3 · Download the image</button>
      <button style={{ ...S.btn, ...S.alt }} onClick={copy}>4 · Copy the link</button>
      <pre style={S.log}>{lines.join('\n')}</pre>
      <button style={{ ...S.btn, ...S.alt }} onClick={copyLog}>📋 Copy the log (send to Hendrik)</button>
    </div>
  )
}
