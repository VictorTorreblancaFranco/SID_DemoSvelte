<script lang="ts">
  import { BrowserProvider, formatEther } from 'ethers'
  import { onMount } from 'svelte'

  type Status = 'idle' | 'connecting' | 'connected' | 'error'

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

  const disconnectedKey = 'kipo-wallet-disconnected'

  const symbols: Record<string, string> = {
    '1': 'ETH',
    '57': 'SYS',
    '137': 'POL',
    '570': 'SYS',
    '5700': 'tSYS',
    '42161': 'ETH',
  }

  const networkLabels: Record<string, string> = {
    '1': 'Ethereum Mainnet',
    '57': 'Syscoin NEVM Mainnet',
    '137': 'Polygon',
    '570': 'Rollux Mainnet',
    '5700': 'Syscoin Tanenbaum Testnet',
    '42161': 'Arbitrum One',
  }

  function explainError(error: unknown) {
    const walletError = error as { code?: number; message?: string }

    if (walletError.code === 4001) return 'La conexión fue rechazada desde Pali Wallet.'
    if (walletError.code === -32002) return 'Pali Wallet ya tiene una solicitud pendiente. Abre la extensión.'
    return walletError.message || 'No pudimos conectarnos. Revisa que Pali Wallet esté desbloqueada.'
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toastMessage = message
    toastType = type
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastMessage = ''
    }, 2500)
  }

  async function readWallet(account?: string) {
    if (!window.ethereum) throw new Error('Pali Wallet no está instalada en este navegador.')

    const provider = new BrowserProvider(window.ethereum)
    const accounts = account
      ? [account]
      : (await window.ethereum.request({ method: 'eth_accounts' }) as string[])

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

  async function connectWallet() {
    if (!window.ethereum) {
      status = 'error'
      errorMessage = 'Pali Wallet no está instalada. Instálala y recarga esta página.'
      return
    }

    status = 'connecting'
    errorMessage = ''

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      manuallyDisconnected = false
      localStorage.removeItem(disconnectedKey)
      await readWallet(accounts[0])
    } catch (error) {
      status = 'error'
      errorMessage = explainError(error)
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

  function clearWalletView(remember = true) {
    address = ''
    balance = '0.0000'
    chainId = ''
    networkName = '—'
    status = 'idle'
    errorMessage = ''
    manuallyDisconnected = remember

    if (remember) localStorage.setItem(disconnectedKey, 'true')
    else localStorage.removeItem(disconnectedKey)
  }

  async function disconnectWallet() {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
      } catch {
        // Algunas versiones de Pali no permiten revocar el permiso desde la página.
      }
    }

    clearWalletView(true)
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
    const provider = window.ethereum
    if (!provider) return

    manuallyDisconnected = localStorage.getItem(disconnectedKey) === 'true'
    if (!manuallyDisconnected) readWallet().catch(() => clearWalletView(false))

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

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  })
</script>

<svelte:head>
  <title>Kipo · Pali Wallet</title>
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
    <h1>Conecta tu Pali Wallet</h1>
    <p>Consulta la dirección y el saldo de tu cuenta.</p>
  </section>

  <section class="wallet-card" class:connected={status === 'connected'}>
    <div class="card-top">
      <div class="pali-logo">P</div>
      <div>
        <small>BILLETERA</small>
        <h2>Pali Wallet</h2>
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

      <button class="primary" onclick={connectWallet} disabled={status === 'connecting'}>
        {status === 'connecting' ? 'Esperando confirmación…' : 'Conectar Pali Wallet'}
      </button>

      {#if status === 'error'}
        <div class="error" role="alert">{errorMessage}</div>
      {/if}
    {/if}
  </section>

  <aside class="security-note">
    <span>🛡️</span>
    <p><strong>Kipo nunca accede a tu clave privada.</strong><br />Pali Wallet solo comparte la dirección autorizada y firma las solicitudes que tú apruebas.</p>
  </aside>

  {#if toastMessage}
    <div class="toast" class:error-toast={toastType === 'error'} role="status" aria-live="polite">
      <span>{toastType === 'success' ? '✓' : '!'}</span>
      {toastMessage}
    </div>
  {/if}
</main>
