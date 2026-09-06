# Kipo · Conexión de billetera

Aplicación web desarrollada con Svelte que permite conectar Pali Wallet o MetaMask, consultar la dirección pública de la cuenta, mostrar el saldo y verificar la red seleccionada.

## Funciones

- Conexión con Pali Wallet mediante `window.ethereum`.
- Compatibilidad con MetaMask como billetera EVM adicional.
- Lectura de la dirección pública.
- Consulta y actualización del saldo.
- Lectura del Chain ID de la red seleccionada.
- Verificación de zkSYS Genesis Testnet (Chain ID `57057`).
- Solicitud para cambiar o agregar zkSYS Genesis desde la billetera.
- Copiado de la dirección.
- Desconexión de la billetera.

## Tecnologías

- Svelte 5
- TypeScript
- Ethers.js 6
- Vite

## Ejecutar el proyecto

```bash
npm install
npm run dev
```

Después, abrir la dirección local mostrada en la terminal y tener instalada la extensión Pali Wallet o MetaMask en el navegador.

## Red de prueba

La demo tiene mapeada **zkSYS Genesis Testnet** con estos datos:

- Chain ID decimal: `57057`
- Chain ID hexadecimal: `0xdee1`
- Moneda: `SYS`
- RPC: `https://rpc-zk.tanenbaum.io/`
- Explorador: `https://explorer-zk.tanenbaum.io/`

Al conectar la billetera, la aplicación obtiene el Chain ID real con Ethers.js y lo compara con `57057`. Si no coincide, muestra la red actual y permite solicitar el cambio desde la extensión.

El listado interno también reconoce Syscoin Tanenbaum (`5700`) y Rollux Tanenbaum (`57000`) como redes de prueba del ecosistema Syscoin.
