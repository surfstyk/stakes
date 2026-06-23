import { encodeFunctionData, formatUnits, parseUnits } from 'viem'

export const POLYGON_CHAIN_ID = '0x89'
export const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
export const USDT_DECIMALS = 6
export const POL_DECIMALS = 18

const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function provider() {
  if (!window.ethereum) {
    throw new Error('No EVM provider — open this inside Nimiq Pay.')
  }
  return window.ethereum
}

export async function requestEvmAccounts(): Promise<string[]> {
  return provider().request<string[]>({ method: 'eth_requestAccounts' })
}

export async function getChainId(): Promise<string> {
  return provider().request<string>({ method: 'eth_chainId' })
}

export async function switchToPolygon(): Promise<void> {
  await provider().request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: POLYGON_CHAIN_ID }],
  })
}

/** Native gas-token (POL) balance — this is what a fresh wallet has 0 of. */
export async function getNativeBalance(address: string): Promise<string> {
  const hex = await provider().request<string>({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  })
  return formatUnits(BigInt(hex), POL_DECIMALS)
}

export async function getUsdtBalance(address: string): Promise<string> {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  const hex = await provider().request<string>({
    method: 'eth_call',
    params: [{ to: USDT_POLYGON, data }, 'latest'],
  })
  return formatUnits(BigInt(hex), USDT_DECIMALS)
}

/** Compose + send a USDT transfer. Triggers the native EVM confirm dialog. */
export async function sendUsdt(from: string, to: string, amount: string): Promise<string> {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to as `0x${string}`, parseUnits(amount, USDT_DECIMALS)],
  })
  return provider().request<string>({
    // Explicit gas limit: a fresh wallet with 0 POL makes on-device gas estimation
    // fail ("must include gas/gasLimit, and estimation failed"), so we supply one.
    method: 'eth_sendTransaction',
    params: [{ from, to: USDT_POLYGON, data, value: '0x0', gas: '0x186a0' }],
  })
}
