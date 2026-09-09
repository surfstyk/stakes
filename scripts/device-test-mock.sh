#!/usr/bin/env bash
#
# Stakes — MOCK on-device test over a cloudflared tunnel (no money, no wallet).
#
# The visual/UX sibling of device-test.sh. It builds a TREASURY-FREE bundle, so the app runs
# entirely off localStorage + the mock vault/stamp: no "Open in Nimiq Pay" gate, no real deposit,
# no live backend. Use it to eyeball the deck, the illustrations, the motion and every screen on a
# real phone — including INSIDE the real Nimiq Pay WebView (via the deeplink QR) — without risking
# a cent. For the full real-money flow (real deposits, live API) use device-test.sh instead.
#
# It builds, tunnels, prints a browser URL + a `nimiqpay://` deeplink, writes a QR of the deeplink
# and OPENS it (Preview on macOS) so you can just scan it. Ctrl-C tears everything down.
#
# How the mock build is forced: a real .env.local (the funded treasury) makes IS_MOCK false. We
# never touch that file — instead we point Vite's envDir at an empty temp dir for this build only,
# so VITE_TREASURY_NIM_ADDRESS is unset and the app picks the mock vault (src/vault/index.ts).
#
# Requirements: cloudflared (brew install cloudflared) · qrencode (brew install qrencode)
#
# Env overrides:
#   APP_QUERY     query appended to the app URL   (default: /?illus  — show the illustrations)
#   PREVIEW_PORT  local preview port              (default: 4188)
#   NO_OPEN=1     don't auto-open the QR in Preview
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_QUERY="${APP_QUERY:-/?illus}"
PORT="${PREVIEW_PORT:-4188}"

command -v cloudflared >/dev/null 2>&1 || { echo "✖ cloudflared not found — brew install cloudflared" >&2; exit 1; }
command -v qrencode   >/dev/null 2>&1 || { echo "✖ qrencode not found — brew install qrencode" >&2; exit 1; }

# scratch: an empty envDir (so .env.local is ignored → treasury unset → mock), a temp vite config
# (at the repo root so `@vitejs/plugin-react` resolves), the mock dist, the QR, the tunnel log.
WORK="$(mktemp -d -t stakes-mock)"
ENVDIR="$WORK/env"; mkdir -p "$ENVDIR"
OUTDIR="$WORK/dist"
QR="$WORK/qr.png"
LOG="$WORK/tunnel.log"; : > "$LOG"
CFG="$ROOT/.vite-mock-$$.config.mjs"

PREVIEW_PID=""; CF_PID=""
cleanup() {
  echo; echo "▸ Tearing down tunnel + preview…"
  [ -n "$CF_PID" ]      && kill "$CF_PID"      2>/dev/null || true
  [ -n "$PREVIEW_PID" ] && kill "$PREVIEW_PID" 2>/dev/null || true
  rm -f "$CFG"
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

cat > "$CFG" <<EOF
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// envDir points at an empty dir so the real .env.local (treasury) is NOT loaded → mock build.
export default defineConfig({ plugins: [react()], envDir: '$ENVDIR', build: { outDir: '$OUTDIR', emptyOutDir: true } })
EOF

echo "▸ Building the MOCK bundle (no treasury → mock vault + mock data)…"
npx tsc --noEmit
npx vite build --config "$CFG"
rm -f "$CFG"
# Guard: never tunnel a build that somehow baked a Nimiq (treasury) address in.
if grep -rIlqE "NQ[0-9A-Z]{2} [0-9A-Z]{4} [0-9A-Z]{4}" "$OUTDIR/assets/" 2>/dev/null; then
  echo "✖ Refusing to serve: a Nimiq address is baked into the build (not a mock build)." >&2
  exit 1
fi

echo "▸ Serving the mock dist on :${PORT} …"
./node_modules/.bin/vite preview --host --port "$PORT" --strictPort --outDir "$OUTDIR" >/dev/null 2>&1 &
PREVIEW_PID=$!

echo "▸ Opening cloudflared tunnel…"
cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
CF_PID=$!

URL=""
for _ in $(seq 1 40); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  kill -0 "$CF_PID" 2>/dev/null || { echo "✖ cloudflared exited:" >&2; cat "$LOG" >&2; exit 1; }
  kill -0 "$PREVIEW_PID" 2>/dev/null || { echo "✖ vite preview exited (port $PORT in use?)" >&2; exit 1; }
  sleep 1
done
[ -z "$URL" ] && { echo "✖ Tunnel URL not found in time. cloudflared log:" >&2; cat "$LOG" >&2; exit 1; }

APP_URL="$URL$APP_QUERY"
# App Link (HTTPS) form — what the app now emits (src/lib/context.ts): strip the scheme and hang
# host+path+query off /miniapps/open/. Routes to Nimiq Pay cold AND warm.
APPLINK="https://nimpay.app/miniapps/open/${APP_URL#https://}"
# Legacy custom scheme — kept only for an on-device A/B: it is DISCARDED when Nimiq Pay is already
# running (the warm-start bug we are fixing). Tap it warm to reproduce; tap the App Link warm to confirm the fix.
DEEPLINK="nimiqpay://miniapp?url=$APP_URL"
qrencode -o "$QR" -s 14 -m 4 "$APPLINK"

echo
echo "══════════════════════════════════════════════════════════════════"
echo "  MOCK build — no wallet, no money."
echo "  Nimiq Pay (App Link):   $APPLINK"
echo "  Legacy scheme (A/B):    $DEEPLINK"
echo "  In a browser:           $APP_URL"
echo "══════════════════════════════════════════════════════════════════"
qrencode -t ANSIUTF8 "$APPLINK"    # scannable straight from the terminal too
echo
if [ "${NO_OPEN:-0}" != "1" ] && command -v open >/dev/null 2>&1; then
  open "$QR" && echo "▸ QR opened in Preview — scan it with your phone camera."
else
  echo "▸ QR written to: $QR"
fi
echo
echo "Scan the QR (or the deeplink) on a phone with Nimiq Pay. Ctrl-C here tears it all down."
wait "$CF_PID"
