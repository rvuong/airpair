// SyncEngine: NTP-style round-trip measurement
// Protocol:
//   Client A sends: { type: "sync-ping", seq, t1 }
//   Server stamps t2 and relays to Client B
//   Client B replies: { type: "sync-pong", seq, t1, t2, t3 }
//   Server stamps t4 and relays back to Client A
//   Client A receives with t4, records t4_client = Date.now()
//
// Formulas:
//   RTT    = t4_client - t1
//   offset = ((t2 - t1) + (t3 - t4_client)) / 2

export interface SyncResult {
  seq: number
  rtt: number
  offset: number
}

// Message shapes received by SyncEngine
// Sent by Client A to server
export interface SyncPingPayload {
  type: 'sync-ping'
  seq: number
  t1: number
}

// Received by Client B: server has added t2 to the original ping
export interface SyncPingRelayed {
  type: 'sync-ping'
  seq: number
  t1: number
  t2: number
}

export interface SyncPongPayload {
  type: 'sync-pong'
  seq: number
  t1: number
  t2: number
  t3: number
  t4: number // server-stamped, ignored — we use our own t4_client
}

export type SyncEngineMessage = SyncPingRelayed | SyncPongPayload

const ITERATIONS = 10
const INTERVAL_MS = 100

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  // For 10 elements (indices 0-9), central element at index 4
  return sorted[Math.floor(sorted.length / 2)]
}

export class SyncEngine {
  readonly results: SyncResult[] = []

  private ws: WebSocket
  private onResult: (result: SyncResult) => void
  private onComplete: (engine: SyncEngine) => void
  private seq = 0
  private pendingPings = new Map<number, number>() // seq -> t1
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(
    ws: WebSocket,
    onResult: (result: SyncResult) => void,
    onComplete: (engine: SyncEngine) => void
  ) {
    this.ws = ws
    this.onResult = onResult
    this.onComplete = onComplete
  }

  // Called by main when this client is Client A (initiator)
  start(): void {
    this.seq = 0
    this.results.length = 0
    this.pendingPings.clear()

    this.intervalId = setInterval(() => {
      if (this.seq >= ITERATIONS) {
        this.stop()
        return
      }
      this.sendPing(this.seq)
      this.seq++
    }, INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  reset(): void {
    this.stop()
    this.results.length = 0
    this.seq = 0
    this.pendingPings.clear()
  }

  // Handle incoming WS messages routed here by main
  handleMessage(msg: SyncEngineMessage): void {
    if (msg.type === 'sync-ping') {
      // We are Client B — reflect pong immediately with t3 = now
      const t3 = Date.now()
      const pong: Record<string, unknown> = {
        type: 'sync-pong',
        seq: msg.seq,
        t1: msg.t1,
        t2: msg.t2,
        t3
      }
      this.ws.send(JSON.stringify(pong))
      return
    }

    if (msg.type === 'sync-pong') {
      // We are Client A — compute RTT and offset
      const t4_client = Date.now()
      const { seq, t1, t2, t3 } = msg
      const rtt = t4_client - t1
      const offset = ((t2 - t1) + (t3 - t4_client)) / 2
      const result: SyncResult = { seq, rtt, offset }
      this.results.push(result)
      this.onResult(result)

      if (this.results.length >= ITERATIONS) {
        this.stop()
        this.onComplete(this)
      }
    }
  }

  get medianRTT(): number {
    if (this.results.length === 0) return 0
    return median(this.results.map(r => r.rtt))
  }

  get medianOffset(): number {
    if (this.results.length === 0) return 0
    return median(this.results.map(r => r.offset))
  }

  private sendPing(seq: number): void {
    const t1 = Date.now()
    this.pendingPings.set(seq, t1)
    const ping: Record<string, unknown> = { type: 'sync-ping', seq, t1 }
    this.ws.send(JSON.stringify(ping))
  }
}
