import { KeyPair } from '@nimiq/core'

// Nimiq's all-zero address has no corresponding private key, so funds sent there
// are provably unspendable — our burn sink (CONCEPT: forfeits are burned).
export const BURN_ADDRESS = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

export const LUNA_PER_NIM = 100_000

export function nimToLuna(nim: number): bigint {
  return BigInt(Math.round(nim * LUNA_PER_NIM))
}
export function lunaToNim(luna: number | bigint): number {
  return Number(luna) / LUNA_PER_NIM
}

/** Load the treasury keypair from the env secret (set in .env.local). */
export function loadTreasury(): KeyPair {
  const hex = process.env.TREASURY_KEYPAIR_HEX
  if (!hex) {
    throw new Error('TREASURY_KEYPAIR_HEX is not set. Add it to .env.local and run with --env-file=.env.local')
  }
  return KeyPair.fromHex(hex)
}

export function treasuryAddress(kp: KeyPair = loadTreasury()): string {
  return kp.toAddress().toUserFriendlyAddress()
}
