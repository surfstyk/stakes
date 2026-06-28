import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// HMR over LAN: when loading from a phone inside Nimiq Pay, the HMR client must
// reach the host machine's LAN IP. Set VITE_HMR_HOST=<your-LAN-IP> if HMR fails
// silently on device (see nimiq.dev "Load a Local Mini App").
const hmrHost = process.env.VITE_HMR_HOST

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow loading via any LAN host/IP (Vite 5 blocks unknown hosts by default).
    allowedHosts: true,
    hmr: hmrHost ? { host: hmrHost, protocol: 'ws', clientPort: 5173 } : undefined,
    // Same-origin /api in dev → proxied to the local API (npm run api). In prod
    // Caddy does the equivalent reverse_proxy, so the frontend never needs CORS.
    proxy: {
      '/api': { target: `http://localhost:${process.env.STAKES_API_PORT ?? 8787}`, changeOrigin: true },
    },
  },
})
