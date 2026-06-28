// Write/broadcast transport for settlement — the PROVEN path (FRAMEWORK-FACTS →
// "Settlement broadcast"): build + sign a transaction OFFLINE with `@nimiq/core`
// (TransactionBuilder + KeyPair work fine in plain Node), then POST the raw hex to a
// node's `sendRawTransaction` over HTTP-RPC (server/rpc.ts).
//
// This replaces the old `@nimiq/core` P2P `Client`, which is broken in plain Node (the
// worker never reaches consensus). Nothing here opens a P2P connection.
//
// Used only by the offline operator settlement job (server/settle.ts) — this is the one
// place the treasury KEY is touched, so it never runs on the internet-facing API box.

import { Address, KeyPair, TransactionBuilder } from '@nimiq/core'
import { sendRawTransaction } from './rpc.ts'

// Albatross network id: 5 = TestAlbatross (testnet), 24 = MainAlbatross (mainnet).
// `getNetworkId` is blocked on the public node, so we use the constant (FRAMEWORK-FACTS).
export const NETWORK_ID = Number(process.env.STAKES_NETWORK_ID ?? 5)

export interface SignedTx {
  hash: string // tx hash (its on-chain id), known before broadcast
  hex: string // raw serialized signed tx (what we POST)
  to: string
  valueLuna: bigint
}

/**
 * Build and sign a NIM transfer entirely offline (no network). `validityStartHeight`
 * should be a recent block height (see rpc.getBlockNumber). `tx.verify` is a local
 * sanity check that the signature + fields are valid before we ever broadcast.
 */
export function buildSignedNim(
  kp: KeyPair,
  recipient: string,
  valueLuna: bigint,
  validityStartHeight: number,
  data?: string,
): SignedTx {
  const sender = kp.toAddress()
  const to = Address.fromUserFriendlyAddress(recipient)
  const tx = data
    ? TransactionBuilder.newBasicWithData(
        sender,
        to,
        new TextEncoder().encode(data),
        valueLuna,
        null,
        validityStartHeight,
        NETWORK_ID,
      )
    : TransactionBuilder.newBasic(sender, to, valueLuna, null, validityStartHeight, NETWORK_ID)
  kp.signTransaction(tx)
  tx.verify(NETWORK_ID) // throws if the signed tx is malformed — fail before broadcasting
  return { hash: tx.hash(), hex: tx.toHex(), to: recipient, valueLuna }
}

/** Broadcast a pre-signed tx via HTTP-RPC. Resolves to the tx hash. */
export async function broadcast(signed: SignedTx): Promise<string> {
  const hash = await sendRawTransaction(signed.hex)
  return hash || signed.hash
}

/** Convenience: build, sign, and broadcast a NIM transfer in one step. */
export async function sendNim(
  kp: KeyPair,
  recipient: string,
  valueLuna: bigint,
  validityStartHeight: number,
  data?: string,
): Promise<string> {
  return broadcast(buildSignedNim(kp, recipient, valueLuna, validityStartHeight, data))
}
