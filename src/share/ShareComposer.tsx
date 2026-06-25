import { useEffect, useRef, useState } from 'react'
import { renderCard } from './renderCard.ts'
import { CARD_STYLES, getStyle, lastStyleId, rememberStyle } from './registry.ts'
import { canvasToPngUrl, copyText, shareImageNative } from './shareCard.ts'
import type { CardData, CardStyle } from './types.ts'

// The share moment, TikTok-text-post style: a live preview, a horizontal strip of
// complete *skins* you flip in one tap, then "share". On HTTPS that opens the native
// share sheet (image + caption + link → straight to a story). If the WebView lacks
// file-sharing, we fall back to a clean in-app panel: save the image (long-press) +
// copy the caption. Content is fixed; the look is what you play with.

const THUMB = { w: 144, h: 256 } // 9:16

function StyleThumb({ style, data }: { style: CardStyle; data: CardData }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (c) void renderCard(c, style, data, THUMB)
  }, [style, data])
  return <canvas ref={ref} className="thumb-canvas" />
}

export function ShareComposer({
  data,
  cta,
  shareText,
  shareUrl,
}: {
  data: CardData
  cta: string
  shareText: string
  shareUrl: string
}) {
  const [styleId, setStyleId] = useState<string>(() => lastStyleId())
  const [postUrl, setPostUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const mainRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = mainRef.current
    if (c) void renderCard(c, getStyle(styleId), data)
  }, [styleId, data])

  function pick(id: string) {
    setStyleId(id)
    rememberStyle(id)
  }

  const caption = `${shareText}\n${shareUrl}`

  function openFallback(c: HTMLCanvasElement) {
    setPostUrl(canvasToPngUrl(c))
    void copyText(caption).then(setCopied)
  }

  // Stays synchronous up to the share() call — native share needs the user gesture.
  function onShare() {
    const c = mainRef.current
    if (!c) return
    const shared = shareImageNative(c, 'stakes.png', caption)
    if (shared) {
      shared.catch((e: unknown) => {
        // user cancelled the sheet → nothing to do; anything else → in-app fallback
        if ((e as { name?: string })?.name !== 'AbortError') openFallback(c)
      })
      return
    }
    openFallback(c)
  }

  // ---- fallback panel (no native share): save the image + copy the caption ----
  if (postUrl) {
    return (
      <div className="composer">
        <p className="composer-ready">Your card’s ready 🎉</p>
        <div className="composer-stage">
          <img className="composer-canvas post-img" src={postUrl} alt="Your card" />
        </div>
        <p className="composer-hint">
          Press &amp; hold the image to save it, then post it to your story 👀
        </p>
        <button className="s-cta" onClick={async () => setCopied(await copyText(caption))}>
          {copied ? 'Caption + link copied ✓' : 'Copy caption + link'}
        </button>
        <button className="s-link composer-back" onClick={() => setPostUrl(null)}>
          ← Back to styles
        </button>
      </div>
    )
  }

  // ---- edit mode: pick a skin ----
  return (
    <div className="composer">
      <div className="composer-stage">
        <canvas ref={mainRef} className="composer-canvas" />
      </div>

      <div className="composer-styles" role="radiogroup" aria-label="Card style">
        {CARD_STYLES.map((st) => (
          <button
            key={st.id}
            type="button"
            className="style-chip"
            role="radio"
            aria-checked={st.id === styleId}
            data-on={st.id === styleId}
            onClick={() => pick(st.id)}
          >
            <StyleThumb style={st} data={data} />
            <span className="style-name">{st.name}</span>
          </button>
        ))}
      </div>

      <button className="s-cta" onClick={onShare}>
        {cta}
      </button>
    </div>
  )
}
