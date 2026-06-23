// Minimal typings for the providers Nimiq Pay injects into the WebView.

export interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
  isNimiqPay?: boolean
}

// Note: window.nimiqPay is declared globally by @nimiq/mini-app-sdk, so we only
// add window.ethereum here to avoid a declaration-merge conflict.
declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export {}
