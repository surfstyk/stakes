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
 * Incoming treasury transactions tagged `stakes:<challengeId>` — on-chain proof that
 * a participant's stake landed. The Mini App attaches this tag on deposit (see
 * src/vault/custodialNim.ts); we recover the depositor from the tx sender.
 */
export async function listStakeDeposits(
  treasury: string,
  challengeId: string,
  max = 200,
): Promise<StakeDeposit[]> {
  const tag = `stakes:${challengeId}`
  const txs = await getTransactionsByAddress(treasury, max)
  return txs
    .filter(
      (t) =>
        normAddr(t.to) === normAddr(treasury) &&
        t.executionResult !== false &&
        decodeData(t.recipientData) === tag,
    )
    .map((t) => ({ from: t.from, valueLuna: t.value, hash: t.hash, at: t.timestamp }))
}
