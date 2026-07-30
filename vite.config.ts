import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// HMR over LAN: when loading from a phone inside Nimiq Pay, the HMR client must
// reach the host machine's LAN IP. Set VITE_HMR_HOST=<your-LAN-IP> if HMR fails
// silently on device (see nimiq.dev "Load a Local Mini App").
const hmrHost = process.env.VITE_HMR_HOST

// Where the SPA's relative /api calls are proxied. Defaults to the local API
// (npm run api). For on-device testing against the LIVE backend, set
// STAKES_API_TARGET=https://stakes.surfstyk.com (see scripts/device-test.sh).
const apiTarget =
  process.env.STAKES_API_TARGET ?? `http://localhost:${process.env.STAKES_API_PORT ?? 8787}`

// Same-origin /api → proxied to apiTarget. In prod Caddy does the equivalent
// reverse_proxy, so the frontend never needs CORS. changeOrigin rewrites the Host
// so a remote https target (the prod box behind Caddy) routes correctly.
const apiProxy = {
  '/api': { target: apiTarget, changeOrigin: true, secure: true },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow loading via any LAN host/IP (Vite 5 blocks unknown hosts by default).
    allowedHosts: true,
    hmr: hmrHost ? { host: hmrHost, protocol: 'ws', clientPort: 5173 } : undefined,
    proxy: apiProxy,
  },
  // `vite preview` serves the real build (dist/). scripts/device-test.sh exposes it
  // over a cloudflared tunnel for on-device testing; allowedHosts:true admits the
  // random *.trycloudflare.com host.
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
    proxy: apiProxy,
  },
})
