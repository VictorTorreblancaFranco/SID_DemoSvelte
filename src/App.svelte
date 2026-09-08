<script lang="ts">
  import { BrowserProvider, formatEther } from 'ethers'
  import { onMount } from 'svelte'

  type Status = 'idle' | 'connecting' | 'connected' | 'error'
  type WalletChoice = 'pali' | 'metamask'

  let status: Status = 'idle'
  let address = ''
  let balance = '0.0000'
  let chainId = ''
  let networkName = '—'
  let currencySymbol = 'SYS'
  let errorMessage = ''
  let isRefreshing = false
  let copied = false
  let toastMessage = ''
  let toastType: 'success' | 'error' = 'success'
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let manuallyDisconnected = false
  let walletName = 'Elige una opción'
  let isSwitchingNetwork = false
  let connectingWallet: WalletChoice | null = null
  let activeProvider: EvmWalletProvider | undefined
  let announcedWallets: Eip6963ProviderDetail[] = []
  let removeProviderListeners: (() => void) | undefined

  const disconnectedKey = 'kipo-wallet-disconnected'
  const testnetChainId = '57057'
  const testnetChainIdHex = '0xdee1'

  const symbols: Record<string, string> = {
    '1': 'ETH',
    '57': 'SYS',
    '137': 'POL',
    '570': 'SYS',
    '5700': 'tSYS',
    '57000': 'tSYS',
    '57057': 'SYS',
    '42161': 'ETH',
  }

  const networkLabels: Record<string, string> = {
    '1': 'Ethereum Mainnet',
    '57': 'Syscoin NEVM Mainnet',
    '137': 'Polygon',
    '570': 'Rollux Mainnet',
    '5700': 'Syscoin Tanenbaum Testnet',
    '57000': 'Rollux Tanenbaum Testnet',
    '57057': 'zkSYS Genesis Testnet',
    '42161': 'Arbitrum One',
  }

  function explainError(error: unknown) {
    const walletError = error as { code?: number; message?: string }

    if (walletError.code === 4001) return `La solicitud fue rechazada desde ${walletName}.`
    if (walletError.code === -32002) return `${walletName} ya tiene una solicitud pendiente. Abre la extensión.`
    return walletError.message || `No pudimos conectarnos. Revisa que ${walletName} esté desbloqueada.`
  }

  function isWallet(detail: Eip6963ProviderDetail, choice: WalletChoice) {
    const identity = `${detail.info.name} ${detail.info.rdns}`.toLowerCase()
    return choice === 'pali' ? identity.includes('pali') : identity.includes('metamask')
  }

  function findWalletProvider(choice: WalletChoice) {
    const announced = announcedWallets.find((wallet) => isWallet(wallet, choice))
    if (announced) return announced.provider

    const injected = window.ethereum
    if (!injected) return undefined

    const providers = injected.providers?.length ? injected.providers : [injected]

    if (choice === 'pali') {
      const identified = providers.find((provider) => provider.isPali)
      if (identified) return identified

      if (window.pali) {
        const metamaskProviders = announcedWallets
          .filter((wallet) => isWallet(wallet, 'metamask'))
          .map((wallet) => wallet.provider)
        return providers.find((provider) => !metamaskProviders.includes(provider)) || injected
      }
    }

    if (choice === 'metamask') {
      if (!window.pali && injected.isMetaMask) return injected
      return providers.find((provider) => provider.isMetaMask && !provider.isPali)
    }

    return undefined
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toastMessage = message
    toastType = type
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastMessage = ''
    }, 2500)
  }

  function listenToProvider(provider: EvmWalletProvider) {
    removeProviderListeners?.()

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      if (!accounts?.length) clearWalletView(false)
      else if (!manuallyDisconnected) readWallet(accounts[0]).catch((error) => {
        errorMessage = explainError(error)
        status = 'error'
      })
    }

    const handleChainChanged = () => {
      if (address && !manuallyDisconnected) readWallet(address).catch((error) => {
        errorMessage = explainError(error)
        status = 'error'
      })
    }

    provider.on?.('accountsChanged', handleAccountsChanged)
    provider.on?.('chainChanged', handleChainChanged)
    removeProviderListeners = () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }

  async function readWallet(account?: string) {
    if (!activeProvider) throw new Error('Primero selecciona una billetera.')

    const provider = new BrowserProvider(activeProvider)
    const accounts = account
      ? [account]
      : (await activeProvider.request({ method: 'eth_accounts' }) as string[])

    if (!accounts.length) {
      clearWalletView(false)
      return
    }

    const currentAddress = accounts[0]
    const [balanceWei, network] = await Promise.all([
      provider.getBalance(currentAddress),
      provider.getNetwork(),
    ])

    const currentChainId = network.chainId.toString()
    address = currentAddress
    balance = Number(formatEther(balanceWei)).toLocaleString('es-PE', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    })
    chainId = currentChainId
    networkName = networkLabels[currentChainId] || network.name || `Red ${currentChainId}`
    currencySymbol = symbols[currentChainId] || 'TOKEN'
    status = 'connected'
    errorMessage = ''
  }

  async function connectWallet(choice: WalletChoice) {
    walletName = choice === 'pali' ? 'Pali Wallet' : 'MetaMask'
    connectingWallet = choice
    const selectedProvider = findWalletProvider(choice)

    if (!selectedProvider) {
      status = 'error'
      errorMessage = `No se encontró ${walletName}. Revisa que la extensión esté instalada, activa y luego recarga la página.`
      connectingWallet = null
      return
    }

    status = 'connecting'
    errorMessage = ''
    activeProvider = selectedProvider

    try {
      const accounts = await selectedProvider.request({ method: 'eth_requestAccounts' }) as string[]
      manuallyDisconnected = false
      localStorage.removeItem(disconnectedKey)
      listenToProvider(selectedProvider)
      await readWallet(accounts[0])
    } catch (error) {
      status = 'error'
      errorMessage = explainError(error)
    } finally {
      connectingWallet = null
    }
  }

  async function refreshBalance() {
    if (!address) return
    isRefreshing = true
    try {
      await readWallet(address)
      showToast('Saldo actualizado')
    } catch (error) {
      status = 'error'
      errorMessage = explainError(error)
      showToast('No se pudo actualizar el saldo', 'error')
    } finally {
      isRefreshing = false
    }
  }

  async function switchToTestnet() {
    if (!activeProvider) return
    isSwitchingNetwork = true

    try {
      await activeProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: testnetChainIdHex }],
      })
      await readWallet(address)
      showToast('Testnet zkSYS seleccionada')
    } catch (error) {
      const walletError = error as { code?: number }

      if (walletError.code === 4902) {
        try {
          await activeProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: testnetChainIdHex,
              chainName: 'zkSYS Genesis Testnet',
              nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 },
              rpcUrls: ['https://rpc-zk.tanenbaum.io/'],
              blockExplorerUrls: ['https://explorer-zk.tanenbaum.io/'],
            }],
          })
          await readWallet(address)
          showToast('Testnet zkSYS agregada')
        } catch (addError) {
          showToast(explainError(addError), 'error')
        }
      } else {
        showToast(explainError(error), 'error')
      }
    } finally {
      isSwitchingNetwork = false
    }
  }

  function clearWalletView(remember = true) {
    address = ''
    balance = '0.0000'
    chainId = ''
    networkName = '—'
    currencySymbol = 'SYS'
    walletName = 'Elige una opción'
    status = 'idle'
    errorMessage = ''
    manuallyDisconnected = remember

    if (remember) localStorage.setItem(disconnectedKey, 'true')
    else localStorage.removeItem(disconnectedKey)
  }

  async function disconnectWallet() {
    if (activeProvider) {
      try {
        await activeProvider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
      } catch {
        // Algunas versiones de Pali no permiten revocar el permiso desde la página.
      }
    }

    removeProviderListeners?.()
    removeProviderListeners = undefined
    clearWalletView(true)
    activeProvider = undefined
    showToast('Billetera desconectada')
  }

  function shortenAddress(value: string) {
    return `${value.slice(0, 8)}…${value.slice(-6)}`
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      copied = true
      showToast('Dirección copiada')
      setTimeout(() => {
        copied = false
      }, 2000)
    } catch {
      showToast('No se pudo copiar la dirección', 'error')
    }
  }

  onMount(() => {
    manuallyDisconnected = localStorage.getItem(disconnectedKey) === 'true'

    const handleProviderAnnouncement = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail
      if (!detail || announcedWallets.some((wallet) => wallet.info.uuid === detail.info.uuid)) return
      announcedWallets = [...announcedWallets, detail]
    }

    window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement)
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleProviderAnnouncement)
      removeProviderListeners?.()
    }
  })
</script>

<svelte:head>
  <title>Kipo · Conectar billetera</title>
</svelte:head>

<main>
  <header>
    <a class="brand" href="/" aria-label="Inicio Kipo">
      <span>K</span>
      <strong>Kipo</strong>
    </a>
  </header>

  <section class="hero">
    <div class="eyebrow"><i></i> Mi billetera</div>
    <h1>Conecta tu billetera</h1>
    <p>Consulta la dirección, el saldo y la red seleccionada.</p>
  </section>

  <section class="wallet-card" class:connected={status === 'connected'}>
    <div class="card-top">
      <div class="pali-logo">{walletName === 'MetaMask' ? 'M' : walletName === 'Pali Wallet' ? 'P' : 'K'}</div>
      <div>
        <small>BILLETERA</small>
        <h2>{walletName}</h2>
      </div>
      <span class="status" class:online={status === 'connected'}>
        <i></i>{status === 'connected' ? 'Conectada' : 'Sin conectar'}
      </span>
    </div>

    {#if status === 'connected'}
      <div class="balance-block">
        <small>SALDO DISPONIBLE</small>
        <div><strong>{balance}</strong><span>{currencySymbol}</span></div>
        <button class="refresh" class:loading={isRefreshing} onclick={refreshBalance} disabled={isRefreshing} aria-label="Actualizar saldo">
          <span>↻</span> {isRefreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div class="details">
        <div>
          <small>ADDRESS</small>
          <button class="address" onclick={copyAddress} title="Copiar dirección">
            <span>{shortenAddress(address)}</span><b>{copied ? '¡Copiado!' : 'Copiar'}</b>
          </button>
        </div>
        <div>
          <small>RED ACTUAL</small>
          <strong>{networkName}</strong>
          <span>Chain ID: {chainId}</span>
        </div>
      </div>

      <div class="network-check" class:verified={chainId === testnetChainId} class:different={chainId !== testnetChainId}>
        <div class="network-check-icon">{chainId === testnetChainId ? '✓' : '!'}</div>
        <div>
          <small>VERIFICACIÓN DE TESTNET</small>
          <strong>{chainId === testnetChainId ? 'Testnet correcta' : 'Red diferente seleccionada'}</strong>
          <span>zkSYS Genesis está mapeada con el Chain ID {testnetChainId}.</span>
        </div>
        {#if chainId !== testnetChainId}
          <button onclick={switchToTestnet} disabled={isSwitchingNetwork}>
            {isSwitchingNetwork ? 'Cambiando…' : 'Cambiar'}
          </button>
        {/if}
      </div>

      <button class="secondary" onclick={disconnectWallet}>Desconectar billetera</button>
    {:else}
      <div class="connect-illustration" aria-hidden="true">
        <span class="wallet-shape"><i></i></span>
        <div class="signal"><i></i><i></i><i></i></div>
        <span class="chain-shape">⌁</span>
      </div>

      <div class="features">
        <span>🔐 Inicio de sesión</span>
        <span>📬 Lectura del address</span>
        <span>💰 Lectura del saldo</span>
      </div>

      <div class="wallet-options">
        <button class="wallet-option pali" onclick={() => connectWallet('pali')} disabled={status === 'connecting'}>
          <b>P</b>
          <span>{connectingWallet === 'pali' ? 'Abriendo…' : 'Pali Wallet'}</span>
        </button>
        <button class="wallet-option metamask" onclick={() => connectWallet('metamask')} disabled={status === 'connecting'}>
          <b>M</b>
          <span>{connectingWallet === 'metamask' ? 'Abriendo…' : 'MetaMask'}</span>
        </button>
      </div>

      {#if status === 'error'}
        <div class="error" role="alert">{errorMessage}</div>
      {/if}
    {/if}
  </section>

  <aside class="security-note">
    <span>🛡️</span>
    <p><strong>Kipo nunca accede a tu clave privada.</strong><br />La billetera solo comparte la dirección autorizada y firma las solicitudes que tú apruebas.</p>
  </aside>

  {#if toastMessage}
    <div class="toast" class:error-toast={toastType === 'error'} role="status" aria-live="polite">
      <span>{toastType === 'success' ? '✓' : '!'}</span>
      {toastMessage}
    </div>
  {/if}
</main>
