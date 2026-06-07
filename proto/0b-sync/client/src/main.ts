import { SyncEngine, SyncResult, SyncEngineMessage } from './sync.js'

// ---------------------------------------------------------------------------
// Types for messages received from the server
// ---------------------------------------------------------------------------

interface MsgRoomCreated { type: 'room-created'; roomId: string }
interface MsgRoomJoined  { type: 'room-joined' }
interface MsgPeerConnected { type: 'peer-connected' }
interface MsgPeerDisconnected { type: 'peer-disconnected' }
interface MsgError { type: 'error'; message: string }

type ServerMessage =
  | MsgRoomCreated
  | MsgRoomJoined
  | MsgPeerConnected
  | MsgPeerDisconnected
  | MsgError
  | SyncEngineMessage

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Element #${id} not found`)
  return el as T
}

function show(el: HTMLElement): void { el.classList.remove('hidden') }
function hide(el: HTMLElement): void { el.classList.add('hidden') }
function setText(el: HTMLElement, text: string): void { el.textContent = text }

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type ClientRole = 'unknown' | 'host' | 'guest'

let ws: WebSocket | null = null
let role: ClientRole = 'unknown'
let roomId = ''
let syncEngine: SyncEngine | null = null

// ---------------------------------------------------------------------------
// UI elements
// ---------------------------------------------------------------------------

const statePairing  = getEl('state-pairing')
const stateMeasure  = getEl('state-measure')

const panelHost       = getEl('panel-host')
const panelJoin       = getEl('panel-join')
const panelConnecting = getEl('panel-connecting')

const roomCodeDisplay = getEl('room-code-display')
const roomUrlEl       = getEl('room-url')
const pairingStatus   = getEl('pairing-status')

const roomCodeInput = getEl<HTMLInputElement>('room-code-input')
const joinError     = getEl('join-error')
const btnJoin       = getEl<HTMLButtonElement>('btn-join')

const connError     = getEl('conn-error')

const measureProgress = getEl('measure-progress')
const ntpTbody        = getEl<HTMLTableSectionElement>('ntp-tbody')

const summaryEl   = getEl('summary')
const statRtt     = getEl('stat-rtt')
const statOffset  = getEl('stat-offset')
const verdictEl   = getEl('verdict')
const btnRestart  = getEl<HTMLButtonElement>('btn-restart')

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function buildWsUrl(): string {
  return `wss://${window.location.host}/ws`
}

function buildRoomUrl(code: string): string {
  return `${window.location.origin}/?room=${code}`
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

function connect(): void {
  const url = buildWsUrl()
  ws = new WebSocket(url)

  ws.addEventListener('open', onWsOpen)
  ws.addEventListener('message', onWsMessage)
  ws.addEventListener('close', onWsClose)
  ws.addEventListener('error', onWsError)
}

function send(msg: Record<string, unknown>): void {
  ws?.send(JSON.stringify(msg))
}

function onWsOpen(): void {
  hide(panelConnecting)
  hide(connError)

  // Check URL for a room code — if present, we are Client B
  const params = new URLSearchParams(window.location.search)
  const codeParam = params.get('room')

  if (codeParam && codeParam.length === 4) {
    // Guest: pre-fill and auto-join
    role = 'guest'
    roomCodeInput.value = codeParam.toUpperCase()
    showJoinPanel()
    // Auto-submit if code comes from URL
    joinRoom(codeParam.toUpperCase())
  } else {
    // Host: create a room
    role = 'host'
    send({ type: 'create-room' })
  }
}

function onWsMessage(event: MessageEvent): void {
  let msg: ServerMessage
  try {
    msg = JSON.parse(event.data as string) as ServerMessage
  } catch {
    console.warn('[WS] Failed to parse message', event.data)
    return
  }

  switch (msg.type) {
    case 'room-created':
      handleRoomCreated(msg)
      break
    case 'room-joined':
      handleRoomJoined()
      break
    case 'peer-connected':
      handlePeerConnected()
      break
    case 'peer-disconnected':
      handlePeerDisconnected()
      break
    case 'error':
      handleServerError(msg)
      break
    case 'sync-ping':
    case 'sync-pong':
      syncEngine?.handleMessage(msg)
      break
    default:
      // Exhaustive check — unknown message types are ignored
      break
  }
}

function onWsClose(): void {
  showConnError('Connexion perdue. Rechargez la page.')
}

function onWsError(): void {
  showConnError('Erreur WebSocket. Vérifiez que le serveur est lancé.')
}

// ---------------------------------------------------------------------------
// Protocol handlers
// ---------------------------------------------------------------------------

function handleRoomCreated(msg: MsgRoomCreated): void {
  roomId = msg.roomId
  showHostPanel(roomId)
}

function handleRoomJoined(): void {
  // Guest is now in the room — waiting for host to start NTP
  showMeasureState()
  initSyncEngine(false)
}

function handlePeerConnected(): void {
  // Host: peer (guest) just connected — start NTP
  showMeasureState()
  initSyncEngine(true)
}

function handlePeerDisconnected(): void {
  showConnError('Pair déconnecté. Rechargez la page.')
  syncEngine?.stop()
}

function handleServerError(msg: MsgError): void {
  if (msg.message === 'room-not-found') {
    setText(joinError, 'Room introuvable. Vérifiez le code.')
  } else if (msg.message === 'room-full') {
    setText(joinError, 'Room déjà complète.')
  } else {
    setText(joinError, `Erreur: ${msg.message}`)
  }
  btnJoin.disabled = false
}

// ---------------------------------------------------------------------------
// Pairing UI
// ---------------------------------------------------------------------------

function showHostPanel(code: string): void {
  show(panelHost)
  hide(panelJoin)
  hide(panelConnecting)

  setText(roomCodeDisplay, code)
  const url = buildRoomUrl(code)
  setText(roomUrlEl, url)
  setText(pairingStatus, 'En attente du second client...')
}

function showJoinPanel(): void {
  hide(panelHost)
  show(panelJoin)
  hide(panelConnecting)
}

function joinRoom(code: string): void {
  const normalized = code.trim().toUpperCase()
  if (normalized.length !== 4) {
    setText(joinError, 'Le code doit contenir 4 lettres.')
    return
  }
  setText(joinError, '')
  btnJoin.disabled = true
  roomId = normalized
  send({ type: 'join', roomId: normalized })
}

// ---------------------------------------------------------------------------
// NTP state
// ---------------------------------------------------------------------------

function showMeasureState(): void {
  hide(statePairing)
  show(stateMeasure)
  hide(summaryEl)
  ntpTbody.innerHTML = ''
  setText(measureProgress, 'Itération 0 / 10')
}

function initSyncEngine(isHost: boolean): void {
  if (!ws) return

  syncEngine = new SyncEngine(ws, onSyncResult, onSyncComplete)

  if (isHost) {
    syncEngine.start()
  }
  // Guest just waits — SyncEngine.handleMessage handles sync-ping
}

function onSyncResult(result: SyncResult): void {
  const count = syncEngine?.results.length ?? 0
  setText(measureProgress, `Itération ${count} / 10`)

  // Remove highlight from previous row
  const prev = ntpTbody.querySelector('tr.current-row')
  if (prev) prev.classList.remove('current-row')

  const tr = document.createElement('tr')
  tr.classList.add('current-row')

  const tdSeq = document.createElement('td')
  const tdRtt = document.createElement('td')
  const tdOffset = document.createElement('td')

  setText(tdSeq, String(result.seq + 1))
  setText(tdRtt, result.rtt.toFixed(1))
  setText(tdOffset, result.offset.toFixed(2))

  tr.appendChild(tdSeq)
  tr.appendChild(tdRtt)
  tr.appendChild(tdOffset)
  ntpTbody.appendChild(tr)
}

function onSyncComplete(engine: SyncEngine): void {
  const mRtt    = engine.medianRTT
  const mOffset = engine.medianOffset
  const absOffset = Math.abs(mOffset)

  setText(statRtt, mRtt.toFixed(1))
  setText(statOffset, mOffset.toFixed(2))

  const pass = absOffset < 20

  verdictEl.className = pass ? 'pass' : 'fail'
  setText(
    verdictEl,
    pass
      ? `PASS — offset median ${mOffset.toFixed(2)} ms (< 20 ms)`
      : `FAIL — offset median ${mOffset.toFixed(2)} ms (> 20 ms)`
  )

  show(summaryEl)
}

// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------

function showConnError(msg: string): void {
  show(connError)
  setText(connError, msg)
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

btnJoin.addEventListener('click', () => {
  joinRoom(roomCodeInput.value)
})

roomCodeInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') joinRoom(roomCodeInput.value)
})

roomCodeInput.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase()
  setText(joinError, '')
})

btnRestart.addEventListener('click', () => {
  if (!ws || !syncEngine) return
  syncEngine.reset()

  // Rebuild table
  ntpTbody.innerHTML = ''
  hide(summaryEl)
  setText(measureProgress, 'Itération 0 / 10')

  // Only host restarts the ping sequence
  if (role === 'host') {
    syncEngine.start()
  }
})

// Prevent scroll/bounce on touch
document.addEventListener('touchmove', (e: TouchEvent) => {
  e.preventDefault()
}, { passive: false })

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

connect()
