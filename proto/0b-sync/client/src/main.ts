import { SyncEngine, SyncResult, SyncEngineMessage } from './sync.js'

// ---------------------------------------------------------------------------
// Types for messages received from the server
// ---------------------------------------------------------------------------

interface MsgRoomCreated { type: 'room-created'; roomId: string }
interface MsgRoomJoined  { type: 'room-joined' }
interface MsgPeerConnected { type: 'peer-connected' }
interface MsgPeerDisconnected { type: 'peer-disconnected' }
interface MsgError { type: 'error'; message: string }
interface MsgSyncDone { type: 'sync-done'; medianRTT: number; medianOffset: number }

type ServerMessage =
  | MsgRoomCreated
  | MsgRoomJoined
  | MsgPeerConnected
  | MsgPeerDisconnected
  | MsgError
  | MsgSyncDone
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

const panelLanding    = getEl('panel-landing')
const panelHost       = getEl('panel-host')
const panelJoin       = getEl('panel-join')
const panelConnecting = getEl('panel-connecting')

const roomCodeDisplay = getEl('room-code-display')
const roomUrlEl       = getEl('room-url')
const pairingStatus   = getEl('pairing-status')

const roomCodeInput = getEl<HTMLInputElement>('room-code-input')
const joinError     = getEl('join-error')
const btnCreate     = getEl<HTMLButtonElement>('btn-create')
const btnShowJoin   = getEl<HTMLButtonElement>('btn-show-join')
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

  if (role === 'host') {
    send({ type: 'create-room' })
  } else {
    // Guest: send the code already stored before connecting
    send({ type: 'join', roomId })
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
    case 'sync-done':
      handleSyncDone(msg)
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

function handleSyncDone(msg: MsgSyncDone): void {
  if (role !== 'guest') return
  showMeasureState()
  showVerdict(msg.medianRTT, msg.medianOffset)
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
  hide(panelLanding)
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
  role = 'guest'
  roomId = normalized
  hide(panelJoin)
  show(panelConnecting)
  connect()
}

// ---------------------------------------------------------------------------
// NTP state
// ---------------------------------------------------------------------------

function showMeasureState(): void {
  hide(statePairing)
  show(stateMeasure)
  hide(summaryEl)
  ntpTbody.innerHTML = ''
  setText(measureProgress, role === 'guest' ? 'Synchronisation en cours...' : 'Itération 0 / 10')
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

function showVerdict(mRtt: number, mOffset: number): void {
  const absOffset = Math.abs(mOffset)
  setText(statRtt, mRtt.toFixed(1))
  setText(statOffset, mOffset.toFixed(2))
  const pass = absOffset < 20
  verdictEl.className = pass ? 'pass' : 'fail'
  setText(
    verdictEl,
    pass
      ? `PASS — offset médian ${mOffset.toFixed(2)} ms (< 20 ms)`
      : `FAIL — offset médian ${mOffset.toFixed(2)} ms (> 20 ms)`
  )
  show(summaryEl)
}

function onSyncComplete(engine: SyncEngine): void {
  const mRtt = engine.medianRTT
  const mOffset = engine.medianOffset
  showVerdict(mRtt, mOffset)
  send({ type: 'sync-done', medianRTT: mRtt, medianOffset: mOffset })
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

btnCreate.addEventListener('click', () => {
  role = 'host'
  hide(panelLanding)
  show(panelConnecting)
  connect()
})

btnShowJoin.addEventListener('click', () => {
  showJoinPanel()
  roomCodeInput.focus()
})

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

// Connexion déclenchée explicitement par btnCreate ou btnJoin — pas au chargement.
