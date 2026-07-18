import { RoomClient } from '../net/ws'
import { drawQR } from '../qr/generate'
import { measureServerOffset } from '../net/sync'
import { THEMES, getUnlockedIds, getLastThemeId, setLastThemeId } from '../game/themes'
import { renderPreparation, TRANSITION_DELAY_MS } from './transition'

/**
 * Renders the host (player A) screen into `container`.
 * Connects to the WebSocket server, requests a room, displays QR + code.
 * When the opponent connects, transitions automatically (no manual launch
 * button — D03) to the game sas via `onReady`. The countdown 3-2-1 no longer
 * happens here: it moved into the game sas after the tilt/touch handshake (§5).
 * Calls `onBack` when the user taps the back button.
 * Returns a `destroy` function for cleanup.
 */
export function renderHost(
  container: HTMLElement,
  onBack: () => void,
  onReady: (client: RoomClient, role: 'A' | 'B', serverOffset: number, themeId: string) => void
): () => void {
  container.innerHTML = `
    <div class="screen screen-host">
      <div class="topbar">
        <button class="btn-back" id="btn-back">← Accueil</button>
        <button class="icon-btn" id="btn-theme" aria-label="Choisir le thème">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="2" fill="#00d4e8"/>
            <rect x="13" y="3" width="8" height="8" rx="2" fill="#ff2d78"/>
            <rect x="8" y="13" width="8" height="8" rx="2" fill="#ffe44d"/>
          </svg>
        </button>
      </div>
      <div class="host-body">
        <p id="host-status" class="host-wait">Connexion en cours…</p>
      </div>
    </div>
  `

  const client = new RoomClient()
  let destroyed = false
  let handedOff = false
  let selectedThemeId = getLastThemeId()

  let themeMenuEl: HTMLElement | null = null
  // Garde-fou (spec §2) : si le sélecteur de thème est ouvert quand l'adversaire
  // se connecte, la transition automatique attend sa fermeture.
  let resumeAfterMenuClose: (() => void) | null = null

  const btnBack = container.querySelector<HTMLButtonElement>('#btn-back')
  const btnTheme = container.querySelector<HTMLButtonElement>('#btn-theme')

  const setStatus = (text: string, cls?: 'success' | 'error'): void => {
    const el = container.querySelector<HTMLElement>('#host-status')
    if (!el) return
    el.textContent = text
    el.className = 'host-wait' + (cls ? ` ${cls}` : '')
  }

  // ---------------------------------------------------------------------------
  // Sélecteur de thème (dropdown ancré à l'icône)
  // ---------------------------------------------------------------------------

  const onDocClick = (e: MouseEvent): void => {
    if (!themeMenuEl) return
    const target = e.target as Node
    const onButton = btnTheme?.contains(target) ?? false
    if (!themeMenuEl.contains(target) && !onButton) closeThemeMenu()
  }

  function selectTheme(id: string): void {
    selectedThemeId = id
    setLastThemeId(id)
    closeThemeMenu()
  }

  function openThemeMenu(): void {
    if (themeMenuEl) return
    const screenEl = container.querySelector<HTMLElement>('.screen-host')
    if (!screenEl) return

    const unlocked = getUnlockedIds()
    const menu = document.createElement('div')
    menu.className = 'theme-menu'

    THEMES.forEach(t => {
      const isUnlocked = unlocked.includes(t.id)
      const isActive = t.id === selectedThemeId
      const item = document.createElement('button')
      item.className = 'theme-item' + (isActive ? ' active' : '') + (isUnlocked ? '' : ' locked')

      const marker = document.createElement('span')
      marker.className = 'theme-marker'
      // 🔒 est un placeholder de wireframe (charte §2.5 : à redessiner avant prod)
      marker.textContent = isActive ? '✓' : isUnlocked ? '' : '🔒'

      const name = document.createElement('span')
      name.textContent = t.name

      item.appendChild(marker)
      item.appendChild(name)

      if (isUnlocked) {
        item.addEventListener('click', (e) => { e.stopPropagation(); selectTheme(t.id) })
      }
      menu.appendChild(item)
    })

    screenEl.appendChild(menu)
    themeMenuEl = menu
    // Différé pour ne pas capter le clic d'ouverture lui-même
    setTimeout(() => document.addEventListener('click', onDocClick), 0)
  }

  function closeThemeMenu(): void {
    if (!themeMenuEl) return
    themeMenuEl.remove()
    themeMenuEl = null
    document.removeEventListener('click', onDocClick)
    const resume = resumeAfterMenuClose
    resumeAfterMenuClose = null
    resume?.()
  }

  function toggleThemeMenu(): void {
    if (themeMenuEl) closeThemeMenu()
    else openThemeMenu()
  }

  function waitForMenuClosed(): Promise<void> {
    if (!themeMenuEl) return Promise.resolve()
    return new Promise<void>((resolve) => { resumeAfterMenuClose = resolve })
  }

  // ---------------------------------------------------------------------------
  // Événements serveur
  // ---------------------------------------------------------------------------

  client.onCreated = async (roomId: string) => {
    if (destroyed) return
    const body = container.querySelector<HTMLElement>('.host-body')
    if (!body) return

    body.innerHTML = `
      <div class="qr-card">
        <div class="qr-wrapper"><canvas id="qr-canvas"></canvas></div>
        <p class="room-code">${roomId}</p>
      </div>
      <p id="host-status" class="host-wait">En attente de ton adversaire…</p>
    `

    const qrCanvas = body.querySelector<HTMLCanvasElement>('#qr-canvas')
    if (qrCanvas) {
      try {
        await drawQR(qrCanvas, roomId)
      } catch (err) {
        console.error('[host] QR draw failed:', err)
      }
    }
  }

  client.onPeerJoined = async () => {
    if (destroyed) return

    setStatus('Ton adversaire a rejoint la partie', 'success')

    const serverOffset = await measureServerOffset(client)
    if (destroyed) return

    // Ne jamais arracher l'utilisateur d'un choix de thème en cours (spec §2)
    await waitForMenuClosed()
    if (destroyed) return

    renderPreparation(container, { status: 'Préparation de la partie…' })

    window.setTimeout(() => {
      if (destroyed) return
      handedOff = true
      onReady(client, 'A', serverOffset, selectedThemeId)
    }, TRANSITION_DELAY_MS)
  }

  client.onError = (message: string) => {
    if (destroyed) return
    setStatus(`Erreur : ${message}`, 'error')
  }

  client.onClose = () => {
    if (destroyed) return
    setStatus('Connexion perdue.', 'error')
  }

  // ---------------------------------------------------------------------------
  // Événements UI
  // ---------------------------------------------------------------------------

  const handleBack = (): void => onBack()
  btnBack?.addEventListener('click', handleBack)

  const handleTheme = (e: MouseEvent): void => { e.stopPropagation(); toggleThemeMenu() }
  btnTheme?.addEventListener('click', handleTheme)

  // ---------------------------------------------------------------------------
  // Connexion + création de room
  // ---------------------------------------------------------------------------

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
    closeThemeMenu()
    btnBack?.removeEventListener('click', handleBack)
    btnTheme?.removeEventListener('click', handleTheme)
    if (!handedOff) client.disconnect()
    container.innerHTML = ''
  }
}
