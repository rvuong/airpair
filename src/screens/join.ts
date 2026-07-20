import { RoomClient } from '../net/ws'
import { startScan } from '../qr/scan'
import { measureServerOffset } from '../net/sync'
import { resumeAudio } from '../game/audio'
import { renderPreparation, TRANSITION_DELAY_MS } from './transition'

/**
 * Renders the join (player B) screen into `container`.
 * État 1 : CTA scanner dominant + fallback saisie du code.
 * État 2 : scan caméra plein cadre + viseur, fallback code toujours visible.
 * État 3 : préparation (miroir de host), puis navigation directe vers le sas.
 * Le countdown 3-2-1 ne se joue plus ici — il a migré dans le sas `game.ts` (§5).
 * La permission caméra ne se demande qu'au clic sur "SCANNER" (D03, §2.3).
 * Calls `onBack` when the user taps the back button.
 * Returns a `destroy` function for cleanup.
 */
export function renderJoin(
  container: HTMLElement,
  onBack: () => void,
  onReady: (client: RoomClient, role: 'A' | 'B', serverOffset: number, themeId: string) => void
): () => void {
  const client = new RoomClient()
  let destroyed = false
  let handedOff = false
  let stopScan: (() => void) | null = null
  let videoStream: MediaStream | null = null

  // ---------------------------------------------------------------------------
  // Caméra
  // ---------------------------------------------------------------------------

  function stopCamera(): void {
    stopScan?.()
    stopScan = null
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop())
      videoStream = null
    }
  }

  // ---------------------------------------------------------------------------
  // État 1 — Rejoindre (CTA scanner + fallback code)
  // ---------------------------------------------------------------------------

  function showForm(error?: string): void {
    stopCamera()
    container.innerHTML = `
      <div class="screen screen-join">
        <div class="topbar">
          <button class="btn-back" id="btn-back">← Accueil</button>
        </div>
        <div class="join-body">
          <button class="btn btn-role-b" id="btn-scan">SCANNER LE QR-CODE</button>
          <div class="join-sep">ou</div>
          <input
            class="input-text"
            id="room-code-input"
            type="text"
            inputmode="text"
            maxlength="6"
            placeholder="Entrer le code"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <p class="status-msg error" id="code-error"${error ? '' : ' style="display:none;"'}>${error ?? ''}</p>
        </div>
      </div>
    `

    container.querySelector<HTMLButtonElement>('#btn-back')
      ?.addEventListener('click', onBack)

    container.querySelector<HTMLButtonElement>('#btn-scan')
      ?.addEventListener('click', () => { resumeAudio(); showScan() })

    const input = container.querySelector<HTMLInputElement>('#room-code-input')
    input?.addEventListener('input', () => {
      input.value = input.value.toUpperCase()
      setCodeError('')
      if (input.value.trim().length === 6) submitCode(input.value)
    })
    input?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') submitCode(input.value)
    })
  }

  function setCodeError(msg: string): void {
    const el = container.querySelector<HTMLElement>('#code-error')
    if (!el) return
    el.textContent = msg
    el.style.display = msg ? '' : 'none'
  }

  function submitCode(raw: string): void {
    const value = raw.trim().toUpperCase()
    if (value.length !== 6) {
      setCodeError('Le code doit faire 6 caractères.')
      return
    }
    resumeAudio()
    setCodeError('')
    connectAndJoin(value)
  }

  // ---------------------------------------------------------------------------
  // État 2 — Scan caméra
  // ---------------------------------------------------------------------------

  function showScan(): void {
    container.innerHTML = `
      <div class="screen screen-join">
        <div class="topbar">
          <button class="btn-back" id="btn-back">← Accueil</button>
        </div>
        <div class="scan-view">
          <video class="scan-video" id="scan-video" autoplay playsinline muted></video>
          <div class="scan-viewfinder"></div>
          <p class="scan-hint" id="scan-hint">Visez le code de ton adversaire</p>
          <button class="link-btn" id="btn-fallback">Saisir le code à la place</button>
        </div>
      </div>
    `

    container.querySelector<HTMLButtonElement>('#btn-back')
      ?.addEventListener('click', onBack)
    container.querySelector<HTMLButtonElement>('#btn-fallback')
      ?.addEventListener('click', () => showForm())

    startCamera()
  }

  function setScanHint(msg: string): void {
    const el = container.querySelector<HTMLElement>('#scan-hint')
    if (el) el.textContent = msg
  }

  function startCamera(): void {
    const video = container.querySelector<HTMLVideoElement>('#scan-video')
    if (!video) return
    // getUserMedia doit rester dans le handler de geste (iOS Safari)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (destroyed || !container.contains(video)) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        videoStream = stream
        video.srcObject = stream
        video.play().catch(() => { /* iOS peut throw hors gesture — ignore */ })

        stopScan = startScan(video, (roomId) => {
          if (destroyed) return
          setScanHint('Code détecté, connexion…')
          stopCamera()
          connectAndJoin(roomId)
        })
      })
      .catch(() => {
        if (!destroyed) showForm("Impossible d'accéder à la caméra. Saisis le code.")
      })
  }

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  function connectAndJoin(roomId: string): void {
    client
      .connect()
      .then(() => { if (!destroyed) client.join(roomId) })
      .catch(() => { if (!destroyed) showForm('Impossible de contacter le serveur.') })
  }

  client.onJoined = async () => {
    if (destroyed) return
    stopCamera()
    renderPreparation(container, { confirm: 'Connecté', status: 'Préparation de la partie…' })

    const serverOffset = await measureServerOffset(client)
    if (destroyed) return

    window.setTimeout(() => {
      if (destroyed) return
      handedOff = true
      // themeId 'arcade' provisoire — le vrai thème (choisi par l'hôte) est
      // adopté dans le sas via le player_ready de A (§5).
      onReady(client, 'B', serverOffset, 'arcade')
    }, TRANSITION_DELAY_MS)
  }

  client.onError = (message: string) => {
    if (destroyed) return
    let text: string
    if (message === 'room_not_found') {
      text = 'Room introuvable, vérifie le code'
    } else if (message === 'room_full') {
      text = 'Room déjà complète'
    } else if (message === 'peer_disconnected') {
      text = 'Adversaire déconnecté, recharge la page'
    } else {
      text = `Erreur : ${message}`
    }
    showForm(text)
  }

  client.onClose = () => {
    if (destroyed) return
    showForm('Connexion perdue, recharge la page')
  }

  // ---------------------------------------------------------------------------
  // Init + destroy
  // ---------------------------------------------------------------------------

  showForm()

  return () => {
    destroyed = true
    stopCamera()
    if (!handedOff) client.disconnect()
    container.innerHTML = ''
  }
}
