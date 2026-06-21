import { RoomClient } from '../net/ws'
import { drawQR } from '../qr/generate'
import { measureServerOffset } from '../net/sync'
import { renderCountdown } from './countdown'
import { resumeAudio } from '../game/audio'
import { THEMES, getUnlockedIds, drawThemeIcon } from '../game/themes'

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
  onReady: (client: RoomClient, role: 'A' | 'B', serverOffset: number, themeId: string) => void
): () => void {
  container.innerHTML = `
    <div class="screen">
      <button class="btn-back" id="btn-back">← Retour</button>
      <h2 class="screen-title">Nouvelle partie</h2>
      <p id="host-status" class="status-msg">Connexion en cours…</p>
    </div>
  `

  const client = new RoomClient()
  let destroyed = false
  let handedOff = false
  let selectedThemeId = 'arcade'

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

    // Theme selector — shown while waiting for player B
    const unlocked = getUnlockedIds()
    const DPR = window.devicePixelRatio || 1
    const selectorEl = document.createElement('div')
    selectorEl.style.cssText = `
      display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:nowrap;
    `

    const iconCanvases: Array<{ themeId: string; el: HTMLCanvasElement }> = []

    THEMES.forEach(t => {
      const isUnlocked = unlocked.includes(t.id)
      const item = document.createElement('div')
      item.style.cssText = `
        display:flex;flex-direction:column;align-items:center;gap:4px;
        cursor:${isUnlocked ? 'pointer' : 'default'};
      `

      const ic = document.createElement('canvas')
      ic.width = Math.round(48 * DPR)
      ic.height = Math.round(64 * DPR)
      ic.style.cssText = `
        width:48px;height:64px;border-radius:6px;box-sizing:border-box;
        outline:${t.id === selectedThemeId ? '2px solid #ffe600' : '2px solid transparent'};
        outline-offset:2px;
      `
      const icCtx = ic.getContext('2d')!
      icCtx.scale(DPR, DPR)
      drawThemeIcon(icCtx, t, 0, 0, 48, 64, !isUnlocked)
      iconCanvases.push({ themeId: t.id, el: ic })

      const label = document.createElement('span')
      label.textContent = t.name
      label.style.cssText = `
        font-size:10px;font-family:-apple-system,sans-serif;
        color:${isUnlocked ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'};
        text-align:center;max-width:52px;line-height:1.2;
      `

      if (isUnlocked) {
        item.addEventListener('click', () => {
          selectedThemeId = t.id
          iconCanvases.forEach(({ themeId, el }) => {
            el.style.outline = themeId === t.id ? '2px solid #ffe600' : '2px solid transparent'
          })
        })
      }

      item.appendChild(ic)
      item.appendChild(label)
      selectorEl.appendChild(item)
    })

    screenEl.appendChild(selectorEl)
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
      handedOff = true
      renderCountdown(container, tStart, serverOffset, () => onReady(client, 'A', serverOffset, selectedThemeId))
    }

    btnLaunch.addEventListener('click', () => {
      resumeAudio()
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
    if (!handedOff) client.disconnect()
    container.innerHTML = ''
  }
}
