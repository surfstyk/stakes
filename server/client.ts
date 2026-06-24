// ⚠️ TRANSPORT TODO (2026-06-24): the @nimiq/core P2P Client used in connect() is BROKEN
// in plain Node — worker init throws "addEventListener is not a function" and it never
// reaches consensus (confirmed in a real terminal, not just the sandbox). The PROVEN
// transport is offline-sign + HTTP JSON-RPC: build/sign with TransactionBuilder (works)
// then POST `sendRawTransaction` to a node — verified against https://rpc.nimiqwatch.com,
// which accepted a signed tx. Before deploy, rewrite connect()/sendNim()/listDeposits() to
// fetch the RPC. See surfstyk-notes/FRAMEWORK-FACTS.md → "Settlement broadcast".
import {
  Address,
  Client,
  ClientConfiguration,
  KeyPair,
  TransactionBuilder,
} from '@nimiq/core'

const NETWORK = 'TestAlbatross'
const norm = (s: string) => s.replace(/\s/g, '')

/** Connect a Node client to the Nimiq testnet and wait for consensus. */
export async function connect(): Promise<Client> {
  const config = new ClientConfiguration()
  config.network(NETWORK)
  config.logLevel('warn')
  const client = await Client.create(config.build())
  await client.waitForConsensusEstablished()
  return client
}

export interface Deposit {
  from: string
  valueLuna: number
  hash: string
}

/**
 * Index stake deposits for a challenge: incoming treasury transactions whose raw
 * data equals `stakes:<challengeId>` (the tag the Mini App attaches on join).
 */
export async function listDeposits(
  client: Client,
  treasury: string,
  challengeId: string,
): Promise<Deposit[]> {
  const tag = `stakes:${challengeId}`
  const txs = await client.getTransactionsByAddress(treasury, 0, null, null, 500, 1)
  const deposits: Deposit[] = []
  for (const tx of txs) {
    if (norm(tx.recipient) !== norm(treasury)) continue // incoming only
    if (tx.data?.type !== 'raw') continue
    let decoded: string
    try {
      decoded = Buffer.from(tx.data.raw, 'hex').toString('utf8')
    } catch {
      continue
    }
    if (decoded !== tag) continue
    deposits.push({ from: tx.sender, valueLuna: tx.value, hash: tx.transactionHash })
  }
  return deposits
}

/** Build, sign (with the treasury key), and broadcast a NIM transfer. */
export async function sendNim(
  client: Client,
  kp: KeyPair,
  recipient: string,
  valueLuna: bigint,
  data?: string,
): Promise<string> {
  const sender = kp.toAddress()
  const to = Address.fromUserFriendlyAddress(recipient)
  const height = await client.getHeadHeight()
  const networkId = await client.getNetworkId()
  const tx = data
    ? TransactionBuilder.newBasicWithData(
        sender,
        to,
        new TextEncoder().encode(data),
        valueLuna,
        null,
        height,
        networkId,
      )
    : TransactionBuilder.newBasic(sender, to, valueLuna, null, height, networkId)
  kp.signTransaction(tx)
  const details = await client.sendTransaction(tx)
  return details.transactionHash
}
