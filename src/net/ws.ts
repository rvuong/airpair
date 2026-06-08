// ---- Game message types (relayed via WS) ----

export type GameMsg =
  | { type: 'hit'; t_exit: number; nx: number; nvx: number; nvy: number }
  | { type: 'miss'; scorer: 'A' | 'B' }
  | { type: 'rematch' }

// ---- Message types (server → client) ----

export interface MsgCreated {
  type: 'created'
  roomId: string
  role: 'A'
}

export interface MsgJoined {
  type: 'joined'
  role: 'B'
}

export interface MsgPeerJoined {
  type: 'peer_joined'
}

export interface MsgRelay {
  type: 'relay'
  payload: unknown
}

export interface MsgError {
  type: 'error'
  message: string
}

export interface MsgServerPong {
  type: 'server_pong'
  t1: number
  t2: number
}

export interface MsgCountdown {
  type: 'countdown'
  t_start: number
}

export type ServerMessage =
  | MsgCreated
  | MsgJoined
  | MsgPeerJoined
  | MsgRelay
  | MsgError
  | MsgServerPong
  | MsgCountdown

// ---- Message types (client → server) ----

interface CmdCreate {
  type: 'create'
}

interface CmdJoin {
  type: 'join'
  roomId: string
}

interface CmdRelay {
  type: 'relay'
  payload: unknown
}

interface CmdServerPing {
  type: 'server_ping'
  t1: number
}

interface CmdStartCountdown {
  type: 'start_countdown'
}

type ClientCommand = CmdCreate | CmdJoin | CmdRelay | CmdServerPing | CmdStartCountdown

// ---- RoomClient ----

const WS_URL: string =
  (import.meta.env['VITE_WS_URL'] as string | undefined) ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

export class RoomClient {
  private socket: WebSocket | null = null

  onCreated: ((roomId: string, role: 'A') => void) | null = null
  onJoined: ((role: 'B') => void) | null = null
  onPeerJoined: (() => void) | null = null
  onRelay: ((payload: unknown) => void) | null = null
  onError: ((message: string) => void) | null = null
  onClose: (() => void) | null = null
  onServerPong: ((t1: number, t2: number) => void) | null = null
  onCountdown: ((tStart: number) => void) | null = null

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(WS_URL)
      this.socket = socket

      socket.addEventListener('open', () => resolve())
      socket.addEventListener('error', () =>
        reject(new Error('WebSocket connection failed'))
      )
      socket.addEventListener('message', (event: MessageEvent<string>) => {
        this.handleMessage(event.data)
      })
      socket.addEventListener('close', () => {
        this.onClose?.()
      })
    })
  }

  create(): void {
    this.send({ type: 'create' })
  }

  join(roomId: string): void {
    this.send({ type: 'join', roomId })
  }

  relay(payload: unknown): void {
    this.send({ type: 'relay', payload })
  }

  serverPing(t1: number): void {
    this.send({ type: 'server_ping', t1 })
  }

  startCountdown(): void {
    this.send({ type: 'start_countdown' })
  }

  disconnect(): void {
    this.socket?.close()
    this.socket = null
  }

  private send(cmd: ClientCommand): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(cmd))
    }
  }

  private handleMessage(raw: string): void {
    let msg: ServerMessage
    try {
      msg = JSON.parse(raw) as ServerMessage
    } catch {
      console.error('[ws] Failed to parse message:', raw)
      return
    }

    switch (msg.type) {
      case 'created':
        this.onCreated?.(msg.roomId, msg.role)
        break
      case 'joined':
        this.onJoined?.(msg.role)
        break
      case 'peer_joined':
        this.onPeerJoined?.()
        break
      case 'relay':
        this.onRelay?.(msg.payload)
        break
      case 'error':
        this.onError?.(msg.message)
        break
      case 'server_pong':
        this.onServerPong?.(msg.t1, msg.t2)
        break
      case 'countdown':
        this.onCountdown?.(msg.t_start)
        break
      default: {
        const _exhaustive: never = msg
        console.warn('[ws] Unknown message type:', _exhaustive)
      }
    }
  }
}
