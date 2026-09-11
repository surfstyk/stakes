import { test, expect, type Page } from '@playwright/test'

// The golden path, driven live in the mock bundle: cold open → start → make it official → seal.
// This is the exact chain of transitions that blanked in the 2026-09-11 report ("Make it official"
// surfaced nothing after a start desync). It runs server-less — the mock adapter (data.ts) does the
// create / deposit / seal in the browser, and the mock vault confirms synchronously, so no native
// wallet sheet is involved. Each step asserts the next screen actually PAINTED (a structural marker
// + the wordmark), so a regression that renders blank fails here instead of in front of a judge.
//
// It keys on the .rs class contract (.carousel, .contract, .dayhero, .selledger) and the single foot
// CTA (.rs-foot .cta) each screen exposes — never on copy, which is keyed and free to change.

const foot = (page: Page) => page.locator('.rs-foot .cta')

test('cold open → taste → official → running day → sealed, never blank', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // 1 · Cold open — the swipe deck, with its one commit button.
  await page.goto('/?rs=clear')
  await expect(page.locator('.carousel')).toBeVisible({ timeout: 15_000 })
  await expect(foot(page)).toBeEnabled()

  // 2 · Start — onStart creates the taste (window) run and routes to the taste screen.
  await foot(page).click()
  await expect(page.locator('.carousel')).toHaveCount(0)
  await expect(page.locator('.heroHex')).toBeVisible() // the filling day-one dot
  await expect(page.locator('button.wm')).toBeVisible() // shell intact, not blank

  // 3 · Make it count → the stake screen (steppers + the official contract).
  await foot(page).click()
  await expect(page.locator('.contract')).toBeVisible()
  await expect(page.locator('.stepper')).toHaveCount(2)

  // 4 · Make it official — the deposit (mock, synchronous) lands us on the running day. THIS is the
  //     transition that used to blank; assert a real day screen painted, not an empty container.
  await foot(page).click()
  await expect(page.locator('.dayhero')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('button.wm')).toBeVisible()

  // 5 · Seal today — the check-in seals day 0 and the day flips to its sealed state (the ledger).
  await foot(page).click()
  await expect(page.locator('.selledger')).toBeVisible({ timeout: 15_000 })

  expect(errors, 'the golden path threw during render').toEqual([])
})
