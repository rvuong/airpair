import { RoomClient } from '../net/ws'
import { drawQR } from '../qr/generate'
import { measureServerOffset } from '../net/sync'
import { renderCountdown } from './countdown'

/**
 * Renders the host (player A) screen into `container`.
 * Connects to the WebSocket server, requests a room, displays QR + code.
 * Calls `onBack` when the user taps the back button.
 * Calls `onReady` after the countdown completes.
 * Returns a `destroy` function for cleanup.
 */
export function renderHost(
  container: HTMLElement,
  onBack: () => void,
  onReady: () => void
): () => void {
  container.innerHTML = `
    <div class="screen">
      <button class="btn-back" id="btn-back">← Retour</button>
      <h2 class="screen-title">Héberger</h2>
      <p id="host-status" class="status-msg">Connexion en cours…</p>
    </div>
  `

  const client = new RoomClient()
  let destroyed = false

  const statusEl = container.querySelector<HTMLElement>('#host-status')

  const setStatus = (text: string, cls?: 'success' | 'error'): void => {
    if (!statusEl) return
    statusEl.textContent = text
    statusEl.className = 'status-msg' + (cls ? ` ${cls}` : '')
  }

  client.onCreated = async (roomId: string) => {
    if (destroyed) return

    const screenEl = container.querySelector<HTMLElement>('.screen')
    if (!screenEl) return

    // Build room UI: QR + code text + waiting message
    const qrCanvas = document.createElement('canvas')
    const qrWrapper = document.createElement('div')
    qrWrapper.className = 'qr-wrapper'
    qrWrapper.appendChild(qrCanvas)

    const codeEl = document.createElement('p')
    codeEl.className = 'room-code'
    codeEl.textContent = roomId

    const waitEl = document.createElement('p')
    waitEl.id = 'host-wait'
    waitEl.className = 'status-msg'
    waitEl.textContent = 'En attente du joueur B…'

    // Remove the loading status paragraph, insert new elements
    statusEl?.remove()
    screenEl.appendChild(qrWrapper)
    screenEl.appendChild(codeEl)
    screenEl.appendChild(waitEl)

    try {
      await drawQR(qrCanvas, roomId)
    } catch (err) {
      console.error('[host] QR draw failed:', err)
    }
  }

  client.onPeerJoined = async () => {
    if (destroyed) return

    const waitEl = container.querySelector<HTMLElement>('#host-wait')
    if (waitEl) {
      waitEl.textContent = 'Joueur B connecté ✓'
      waitEl.className = 'status-msg success'
    }

    const screenEl = container.querySelector<HTMLElement>('.screen')
    if (!screenEl) return

    // Add network sync status
    const syncEl = document.createElement('p')
    syncEl.id = 'sync-status'
    syncEl.className = 'status-msg'
    syncEl.textContent = 'Mesure du réseau…'
    screenEl.appendChild(syncEl)

    const serverOffset = await measureServerOffset(client)

    if (destroyed) return

    syncEl.textContent = 'Réseau OK ✓'
    syncEl.className = 'status-msg success'

    // Add launch button
    const btnLaunch = document.createElement('button')
    btnLaunch.className = 'btn btn-primary'
    btnLaunch.id = 'btn-launch'
    btnLaunch.textContent = 'Lancer ▶'
    screenEl.appendChild(btnLaunch)

    client.onCountdown = (tStart: number) => {
      destroyed = true
      renderCountdown(container, tStart, serverOffset, onReady)
    }

    btnLaunch.addEventListener('click', () => {
      btnLaunch.disabled = true
      client.startCountdown()
    })
  }

  client.onError = (message: string) => {
    if (destroyed) return
    setStatus(`Erreur : ${message}`, 'error')
  }

  client.onClose = () => {
    if (destroyed) return
    const waitEl = container.querySelector<HTMLElement>('#host-wait')
    if (waitEl) {
      waitEl.textContent = 'Connexion perdue.'
      waitEl.className = 'status-msg error'
    } else {
      setStatus('Connexion perdue.', 'error')
    }
  }

  // Back button
  const btnBack = container.querySelector<HTMLButtonElement>('#btn-back')
  const handleBack = (): void => onBack()
  btnBack?.addEventListener('click', handleBack)

  // Connect and create room
  client
    .connect()
    .then(() => {
      if (!destroyed) client.create()
    })
    .catch(() => {
      if (!destroyed) setStatus('Impossible de contacter le serveur.', 'error')
    })

  return () => {
    destroyed = true
    btnBack?.removeEventListener('click', handleBack)
    client.disconnect()
    container.innerHTML = ''
  }
}
