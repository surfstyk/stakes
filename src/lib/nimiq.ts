import { init } from '@nimiq/mini-app-sdk'

// Local shape of the Nimiq provider per the API reference (nimiq.dev).
// We cast the init() result to this so the recon tool compiles regardless of the
// package's exact exported type names.
export interface NimiqProvider {
  listAccounts(): Promise<string[]>
  sign(
    message: string | { message: string; isHex?: boolean },
  ): Promise<{ publicKey: string; signature: string }>
  isConsensusEstablished(): Promise<boolean>
  getBlockNumber(): Promise<number>
  sendBasicTransaction(args: {
    recipient: string
    value: number
    fee?: number
    validityStartHeight?: number
  }): Promise<string>
  sendBasicTransactionWithData(args: {
    recipient: string
    value: number
    data: string
    fee?: number
    validityStartHeight?: number
  }): Promise<string>
}

export const LUNA_PER_NIM = 100_000

let cached: NimiqProvider | null = null

/**
 * Resolve the Nimiq provider. init() only resolves once Nimiq Pay injects the
 * provider, so outside Nimiq Pay (e.g. a desktop browser) it would hang — we race
 * it against a timeout to fail fast with a clear message.
 */
export async function getNimiq(timeoutMs = 5000): Promise<NimiqProvider> {
  if (cached) return cached
  const ready = init() as unknown as Promise<NimiqProvider>
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Nimiq provider not detected — open this inside Nimiq Pay.')),
      timeoutMs,
    ),
  )
  cached = await Promise.race([ready, timeout])
  return cached
}

export function nimToLuna(nim: number): number {
  return Math.round(nim * LUNA_PER_NIM)
}

/**
 * True when a provider error is the user backing out of the native Nimiq Pay dialog
 * (declined / dismissed a payment or signature) rather than a real failure. Lets the UI
 * treat a cancellation as a calm "nothing happened", not a red error. Covers the
 * EIP-1193 user-rejected code (4001) and the common cancel wordings across providers.
 */
export function isUserCancel(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code
  if (code === 4001) return true
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return /cancel|reject|deni|declin|abort|dismiss|user closed|closed by user/.test(msg)
}
