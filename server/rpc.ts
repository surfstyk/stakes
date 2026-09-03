import { isDepositTag } from '../src/vault/payload.ts'

// HTTP JSON-RPC read client for the Nimiq (Albatross) chain — plain `fetch`, no deps.
//
// This is the PROVEN transport (FRAMEWORK-FACTS → "Settlement broadcast"): the
// `@nimiq/core` P2P Client in server/client.ts is broken in plain Node, so the API
// reads chain state over HTTP-RPC instead. Defaults to Hendrik's nimiqscan testnet
// node (verified reachable, MVP.md); override with STAKES_RPC_URL for mainnet.
//
// Used by deposit verification (server/verify.ts) to confirm a stake landed on-chain.

const RPC_URL = process.env.STAKES_RPC_URL ?? 'https://rpc-testnet.nimiqscan.com/'

interface RpcEnvelope<T> {
  result?: { data: T; metadata: unknown }
  error?: { code: number; message: string; data?: string }
}

let nextId = 1
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  })
  if (!res.ok) throw new Error(`RPC ${method}: HTTP ${res.status}`)
  const env = (await res.json()) as RpcEnvelope<T>
  if (env.error) {
    throw new Error(`RPC ${method}: ${env.error.message}${env.error.data ? ` (${env.error.data})` : ''}`)
  }
  if (!env.result) throw new Error(`RPC ${method}: empty result`)
  return env.result.data
}

export function getBlockNumber(): Promise<number> {
  return rpc<number>('getBlockNumber', [])
}

/** Broadcast a pre-signed, hex-serialized transaction. Resolves to the tx hash. */
export function sendRawTransaction(rawTxHex: string): Promise<string> {
  return rpc<string>('sendRawTransaction', [rawTxHex])
}

/** Account balance in luna (used to check the treasury is funded before settling). */
export async function getBalanceLuna(address: string): Promise<number> {
  const acc = await rpc<{ balance: number }>('getAccountByAddress', [address])
  return acc.balance
}

// Shape returned by nimiqscan's getTransactionsByAddress (the fields we use).
export interface ChainTx {
  hash: string
  from: string // user-friendly NQ… address (spaced)
  to: string
  value: number // luna
  recipientData: string // hex-encoded tx data
  timestamp: number
  confirmations: number
  executionResult: boolean
}

/** One transaction by hash (throws if the node doesn't know it). */
export function getTransactionByHash(hash: string): Promise<ChainTx> {
  return rpc<ChainTx>('getTransactionByHash', [hash])
}

/** Most-recent transactions touching `address` (newest first). */
export function getTransactionsByAddress(address: string, max = 100): Promise<ChainTx[]> {
  // signature: (address, max, startAt | null)
  return rpc<ChainTx[]>('getTransactionsByAddress', [address, max, null])
}

export const normAddr = (s: string) => s.replace(/\s/g, '').toUpperCase()
const decodeData = (hex: string) => {
  try {
    return Buffer.from(hex, 'hex').toString('utf8')
  } catch {
    return ''
  }
}

export interface StakeDeposit {
  from: string
  valueLuna: number
  hash: string
  at: number
}

/**
 * Incoming treasury transactions tagged as a stake deposit for `challengeId` — on-chain proof
 * that a participant's stake landed. The Mini App attaches `stakes.day official:<id>` on deposit
 * (src/vault/custodialNim.ts; the Cycle-I `stakes:<id>` tag still parses — src/vault/payload.ts);
 * we recover the depositor from the tx sender.
 */
export async function listStakeDeposits(
  treasury: string,
  challengeId: string,
  max = 1000,
): Promise<StakeDeposit[]> {
  const txs = await getTransactionsByAddress(treasury, max)
  return txs.filter((t) => isStakeDepositTx(t, treasury, challengeId)).map(toStakeDeposit)
}

/** The one predicate that makes a chain tx a stake deposit for `challengeId` at `treasury`. */
export function isStakeDepositTx(t: ChainTx, treasury: string, challengeId: string): boolean {
  return normAddr(t.to) === normAddr(treasury) && t.executionResult !== false && isDepositTag(decodeData(t.recipientData), challengeId)
}
const toStakeDeposit = (t: ChainTx): StakeDeposit => ({ from: t.from, valueLuna: t.value, hash: t.hash, at: t.timestamp })

export const HASH_RE = /^[0-9a-f]{64}$/i

/**
 * Look up ONE reported deposit hash directly. A finalized tx is permanent, so — unlike the
 * newest-N address scan above — this can never "lose" a deposit once traffic at the treasury grows
 * past the scan window (audit H2). Returns null if the tx is unknown or is not a deposit for this
 * challenge; throws only on transport failure (the caller treats that as "stay unconfirmed, retry").
 */
export async function lookupStakeDeposit(treasury: string, challengeId: string, hash: string): Promise<StakeDeposit | null> {
  if (!HASH_RE.test(hash)) return null
  let t: ChainTx
  try {
    t = await getTransactionByHash(hash.toLowerCase())
  } catch (e) {
    if (/not found/i.test((e as Error).message)) return null
    throw e
  }
  return isStakeDepositTx(t, treasury, challengeId) ? toStakeDeposit(t) : null
}
