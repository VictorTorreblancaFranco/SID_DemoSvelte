/// <reference types="svelte" />
/// <reference types="vite/client" />

interface PaliProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
  on?(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void
  removeListener?(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void
  isPali?: boolean
  isMetaMask?: boolean
}

interface Window {
  ethereum?: PaliProvider
}
