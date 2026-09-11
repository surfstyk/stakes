import { defineConfig } from '@playwright/test'

// Tier-2 harness: drive the REAL built app (the mock bundle — server-less, no native wallet) in a
// headless phone frame. It guards the "works flawlessly first try" surface a judge touches by hand:
// the golden path never blanks (flow.spec) and no screen is a dead end or overflows (crawl.spec).
// The native Nimiq Pay confirm sheets can't be automated (no key access) — that stays on-device.
//
// The webServer builds the mock bundle and serves it on 4180 (see vite.mock.config.mts). 390×711 is
// the real usable app height inside the Nimiq Pay chrome (screens-check/render.sh); reducedMotion
// stills the cold-open carousel nudge so clicks are deterministic.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4180',
    viewport: { width: 390, height: 711 },
    hasTouch: true,
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build:mock && npm run preview:mock',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
