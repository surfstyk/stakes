import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The MOCK build — a server-less bundle for the Playwright harness (and any offline preview).
//
// `envDir` points at an empty directory so the real .env.local (treasury + stamp addresses) is
// ignored. With no VITE_TREASURY_NIM_ADDRESS the app runs its mock adapter (data.ts → mockApi:
// the whole funnel runs in the browser off localStorage + the mock vault, no API), and DEV_TOOLS
// stays on (flags.ts) so the `?rs=<seed>` state-jumps work. Same trick screens-check/render.sh uses
// with a temp config, committed here so CI and local share one path. Output goes to dist-mock/.
const emptyEnv = fileURLToPath(new URL('./e2e/empty-env', import.meta.url))

export default defineConfig({
  plugins: [react()],
  envDir: emptyEnv,
  build: { outDir: 'dist-mock', emptyOutDir: true },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true },
})
