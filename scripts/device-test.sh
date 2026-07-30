#!/usr/bin/env bash
#
# Stakes — on-device test build over a cloudflared tunnel.
#
# Serves a PRODUCTION-LIKE build (`npm run build` — the ?test fast-clock and ?recon
# dev tools are KEPT, unlike the public `build:public` submission strip) at an ephemeral
# HTTPS URL you can open inside Nimiq Pay. It never touches the live stakes.surfstyk.com
# deploy — this is a throwaway tunnel to a build running on your laptop.
#
# By default the build's relative /api calls are proxied to the LIVE production backend
# (https://stakes.surfstyk.com) so you test against real challenge state + real mainnet
# deposits. Point it elsewhere with STAKES_API_TARGET (e.g. http://localhost:8787 for a
# local `npm run api` + throwaway SQLite).
#
# The build embeds VITE_TREASURY_NIM_ADDRESS from .env.local — keep that the real
# mainnet treasury so deposits match what the prod API verifies.
#
# Requirements: cloudflared  (brew install cloudflared)
# Everything is torn down on Ctrl-C — nothing is left running.
#
# Env overrides:
#   STAKES_API_TARGET   /api proxy target      (default: https://stakes.surfstyk.com)
#   PREVIEW_PORT        local preview port     (default: 4173)
#   TUNNEL_LOG          cloudflared log path   (default: a mktemp file)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_TARGET="${STAKES_API_TARGET:-https://stakes.surfstyk.com}"
PORT="${PREVIEW_PORT:-4173}"
LOG="${TUNNEL_LOG:-$(mktemp -t stakes-tunnel)}"

command -v cloudflared >/dev/null 2>&1 || {
  echo "✖ cloudflared not found — install it:  brew install cloudflared" >&2
  exit 1
}

echo "▸ Building production-like bundle (dev tools kept)…"
npm run build

PREVIEW_PID=""; CF_PID=""
cleanup() {
  echo; echo "▸ Tearing down tunnel + preview…"
  [ -n "$CF_PID" ]      && kill "$CF_PID"      2>/dev/null || true
  [ -n "$PREVIEW_PID" ] && kill "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "▸ Serving dist/ on :$PORT   (/api → $API_TARGET)…"
STAKES_API_TARGET="$API_TARGET" \
  ./node_modules/.bin/vite preview --host --port "$PORT" --strictPort >/dev/null 2>&1 &
PREVIEW_PID=$!

echo "▸ Opening cloudflared tunnel…"
: > "$LOG"
cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
CF_PID=$!

# Wait for cloudflared to print the public URL.
URL=""
for _ in $(seq 1 40); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  # Bail early if either child died.
  kill -0 "$CF_PID" 2>/dev/null || { echo "✖ cloudflared exited:" >&2; cat "$LOG" >&2; exit 1; }
  kill -0 "$PREVIEW_PID" 2>/dev/null || { echo "✖ vite preview exited (port $PORT in use?)" >&2; exit 1; }
  sleep 1
done
[ -z "$URL" ] && { echo "✖ Tunnel URL not found in time. cloudflared log:" >&2; cat "$LOG" >&2; exit 1; }

DEEPLINK="nimiqpay://miniapp?url=$URL"
echo
echo "══════════════════════════════════════════════════════════════════"
echo "  Test URL:   $URL"
echo "  Deeplink:   $DEEPLINK"
echo "  Backend:    $API_TARGET"
echo "  Dev tools:  append ?test (5-min fast clock) or ?recon"
echo "══════════════════════════════════════════════════════════════════"
# Scannable QR of the deeplink if qrencode is around (brew install qrencode).
if command -v qrencode >/dev/null 2>&1; then
  echo; qrencode -t ANSIUTF8 "$DEEPLINK"
fi
echo
echo "Open the deeplink on a phone with Nimiq Pay. Ctrl-C here tears it all down."
wait "$CF_PID"
