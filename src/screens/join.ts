import { RoomClient } from '../net/ws.ts'
import { startScan } from '../qr/scan.ts'
import { measureServerOffset } from '../net/sync.ts'
import { renderCountdown } from './countdown.ts'

type Tab = 'scanner' | 'code'

/**
 * Renders the join (player B) screen into `container`.
 * Two tabs: scanner (camera QR) and code (manual input).
 * Calls `onBack` when the user taps the back button.
 * Returns a `destroy` function for cleanup.
 */
export function renderJoin(
  container: HTMLElement,
  onBack: () => void,
  onReady: () => void
): () => void {
  container.innerHTML = `
    <div class="screen">
      <button class="btn-back" id="btn-back">← Retour</button>
      <h2 class="screen-title">Rejoindre</h2>

      <div class="tab-bar" role="tablist">
        <button class="btn-tab active" id="tab-scanner" role="tab" aria-selected="true">Scanner</button>
        <button class="btn-tab" id="tab-code" role="tab" aria-selected="false">Code</button>
      </div>

      <!-- Scanner tab panel -->
      <div id="panel-scanner">
        <div class="video-container">
          <video id="scan-video" autoplay playsinline muted></video>
          <div class="scan-overlay">
            <div class="scan-reticle"></div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-start-camera">Démarrer la caméra</button>
        <p class="status-msg" id="scan-status"></p>
      </div>

      <!-- Code tab panel -->
      <div id="panel-code" style="display:none; flex-direction:column; align-items:center; gap:20px; width:100%;">
        <input
          class="input-text"
          id="room-code-input"
          type="text"
          inputmode="text"
          maxlength="6"
          placeholder="A3F7K9"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="characters"
          spellcheck="false"
        />
        <button class="btn btn-primary" id="btn-join-code">Rejoindre</button>
        <p class="status-msg error" id="code-error" style="display:none;"></p>
      </div>

      <p class="status-msg success" id="join-success" style="display:none;">Connecté ✓</p>
    </div>
  `

  const client = new RoomClient()
  let destroyed = false
  let stopScan: (() => void) | null = null
  let videoStream: MediaStream | null = null
  let activeTab: Tab = 'scanner'

  // DOM refs
  const btnBack = container.querySelector<HTMLButtonElement>('#btn-back')
  const tabScanner = container.querySelector<HTMLButtonElement>('#tab-scanner')
  const tabCode = container.querySelector<HTMLButtonElement>('#tab-code')
  const panelScanner = container.querySelector<HTMLElement>('#panel-scanner')
  const panelCode = container.querySelector<HTMLElement>('#panel-code')
  const btnStartCamera = container.querySelector<HTMLButtonElement>('#btn-start-camera')
  const video = container.querySelector<HTMLVideoElement>('#scan-video')
  const scanStatus = container.querySelector<HTMLElement>('#scan-status')
  const roomCodeInput = container.querySelector<HTMLInputElement>('#room-code-input')
  const btnJoinCode = container.querySelector<HTMLButtonElement>('#btn-join-code')
  const codeError = container.querySelector<HTMLElement>('#code-error')
  const joinSuccess = container.querySelector<HTMLElement>('#join-success')

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function setCodeError(msg: string): void {
    if (!codeError) return
    codeError.textContent = msg
    codeError.style.display = msg ? '' : 'none'
  }

  function setScanStatus(msg: string): void {
    if (scanStatus) scanStatus.textContent = msg
  }

  function showSuccess(): void {
    if (joinSuccess) joinSuccess.style.display = ''
  }

  function stopCamera(): void {
    stopScan?.()
    stopScan = null
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop())
      videoStream = null
    }
    if (video) {
      video.srcObject = null
    }
  }

  // ---------------------------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------------------------

  function switchTab(tab: Tab): void {
    activeTab = tab
    if (tab === 'scanner') {
      panelScanner && (panelScanner.style.display = '')
      panelCode && (panelCode.style.display = 'none')
      tabScanner?.classList.add('active')
      tabCode?.classList.remove('active')
      tabScanner?.setAttribute('aria-selected', 'true')
      tabCode?.setAttribute('aria-selected', 'false')
    } else {
      panelScanner && (panelScanner.style.display = 'none')
      panelCode && (panelCode.style.display = 'flex')
      tabCode?.classList.add('active')
      tabScanner?.classList.remove('active')
      tabCode?.setAttribute('aria-selected', 'true')
      tabScanner?.setAttribute('aria-selected', 'false')
      // Stop camera if it was running
      stopCamera()
    }
  }

  // ---------------------------------------------------------------------------
  // WebSocket setup
  // ---------------------------------------------------------------------------

  function connectAndJoin(roomId: string): void {
    client
      .connect()
      .then(() => {
        if (!destroyed) client.join(roomId)
      })
      .catch(() => {
        if (!destroyed) {
          if (activeTab === 'code') {
            setCodeError('Impossible de contacter le serveur.')
            if (btnJoinCode) btnJoinCode.disabled = false
          } else {
            setScanStatus('Impossible de contacter le serveur.')
          }
        }
      })
  }

  client.onJoined = async () => {
    if (destroyed) return
    stopCamera()
    showSuccess()
    setScanStatus('')
    setCodeError('')

    const screenEl = container.querySelector<HTMLElement>('.screen')
    if (!screenEl) return

    // Add sync status
    const syncEl = document.createElement('p')
    syncEl.id = 'sync-status'
    syncEl.className = 'status-msg'
    syncEl.textContent = 'Synchronisation…'
    screenEl.appendChild(syncEl)

    const serverOffset = await measureServerOffset(client)

    if (destroyed) return

    syncEl.textContent = 'En attente du lancement…'

    client.onCountdown = (tStart: number) => {
      destroyed = true
      renderCountdown(container, tStart, serverOffset, onReady)
    }
  }

  client.onError = (message: string) => {
    if (destroyed) return
    let text: string
    if (message === 'room_not_found') {
      text = 'Room introuvable, vérifiez le code'
    } else if (message === 'room_full') {
      text = 'Room déjà complète'
    } else if (message === 'peer_disconnected') {
      text = 'Pair déconnecté, rechargez la page'
    } else {
      text = `Erreur : ${message}`
    }
    if (activeTab === 'code') {
      setCodeError(text)
      if (btnJoinCode) btnJoinCode.disabled = false
    } else {
      setScanStatus(text)
      // Re-enable camera button so user can retry
      if (btnStartCamera) btnStartCamera.disabled = false
    }
  }

  client.onClose = () => {
    if (destroyed) return
    const text = 'Connexion perdue, rechargez la page'
    if (activeTab === 'code') {
      setCodeError(text)
    } else {
      setScanStatus(text)
    }
  }

  // ---------------------------------------------------------------------------
  // Camera / QR scan
  // ---------------------------------------------------------------------------

  function startCamera(): void {
    if (!video) return
    // getUserMedia must be called in a user gesture handler (iOS Safari requirement)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (destroyed) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        videoStream = stream
        video.srcObject = stream
        video.play().catch(() => {
          // play() may throw on iOS if not in gesture context — ignore
        })
        setScanStatus('Pointez vers le QR code…')
        if (btnStartCamera) btnStartCamera.style.display = 'none'

        stopScan = startScan(video, (roomId) => {
          if (destroyed) return
          setScanStatus('QR détecté, connexion…')
          stopCamera()
          connectAndJoin(roomId)
        })
      })
      .catch(() => {
        if (!destroyed) {
          setScanStatus("Impossible d'accéder à la caméra. Utilisez l'onglet Code.")
          if (btnStartCamera) btnStartCamera.disabled = false
        }
      })

    if (btnStartCamera) btnStartCamera.disabled = true
  }

  // ---------------------------------------------------------------------------
  // Code input join
  // ---------------------------------------------------------------------------

  function joinByCode(): void {
    const value = roomCodeInput?.value.trim().toUpperCase() ?? ''
    if (value.length === 0) {
      setCodeError('Entrez un code de room.')
      return
    }
    if (value.length !== 6) {
      setCodeError('Le code doit faire 6 caractères.')
      return
    }
    setCodeError('')
    if (btnJoinCode) btnJoinCode.disabled = true
    connectAndJoin(value)
  }

  // ---------------------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------------------

  const handleBack = (): void => onBack()
  btnBack?.addEventListener('click', handleBack)

  tabScanner?.addEventListener('click', () => switchTab('scanner'))
  tabCode?.addEventListener('click', () => switchTab('code'))

  // Camera button — getUserMedia inside user gesture handler (iOS Safari)
  btnStartCamera?.addEventListener('click', startCamera)

  btnJoinCode?.addEventListener('click', joinByCode)

  roomCodeInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') joinByCode()
  })

  roomCodeInput?.addEventListener('input', () => {
    if (roomCodeInput) {
      roomCodeInput.value = roomCodeInput.value.toUpperCase()
    }
    setCodeError('')
  })

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  return () => {
    destroyed = true
    btnBack?.removeEventListener('click', handleBack)
    stopCamera()
    client.disconnect()
    container.innerHTML = ''
  }
}
