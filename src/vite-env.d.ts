/// <reference types="svelte" />
/// <reference types="vite/client" />

interface EvmWalletProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
  on?(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void
  removeListener?(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void
  providers?: EvmWalletProvider[]
  isPali?: boolean
  isMetaMask?: boolean
}

interface Eip6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo
  provider: EvmWalletProvider
}

interface Window {
  ethereum?: EvmWalletProvider
  pali?: unknown
}
