import { RoomClient } from '../net/ws'
import { drawQR } from '../qr/generate'

/**
 * Renders the host (player A) screen into `container`.
 * Connects to the WebSocket server, requests a room, displays QR + code.
 * Calls `onBack` when the user taps the back button.
 * Returns a `destroy` function for cleanup.
 */
export function renderHost(
  container: HTMLElement,
  onBack: () => void
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

  client.onPeerJoined = () => {
    if (destroyed) return
    const waitEl = container.querySelector<HTMLElement>('#host-wait')
    if (waitEl) {
      waitEl.textContent = 'Joueur B connecté ! ✓'
      waitEl.className = 'status-msg success'
    }
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
