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

export type ServerMessage =
  | MsgCreated
  | MsgJoined
  | MsgPeerJoined
  | MsgRelay
  | MsgError

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

type ClientCommand = CmdCreate | CmdJoin | CmdRelay

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
      default: {
        const _exhaustive: never = msg
        console.warn('[ws] Unknown message type:', _exhaustive)
      }
    }
  }
}
