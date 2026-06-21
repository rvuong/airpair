// ---------------------------------------------------------------------------
// TiltController — ported from proto/0a-tilt (validated)
// ---------------------------------------------------------------------------

export interface TiltParams {
  deadzone: number
  amplitude: number
  exponent: number
  alpha: number
}

export class TiltController {
  private gamma0 = 0
  private lastGamma = 0
  private smoothed = 0
  private rawCmd = 0
  private touchStartX: number | null = null
  private touchCmd = 0
  private usingTouch = false
  private tiltActive = false

  params: TiltParams

  constructor(params: TiltParams) {
    this.params = { ...params }
  }

  calibrate(g: number): void {
    this.gamma0 = g
    this.lastGamma = g
    this.smoothed = 0
    this.rawCmd = 0
    this.tiltActive = false
  }

  onDeviceOrientation(gamma: number): void {
    this.tiltActive = true
    this.lastGamma = gamma
    const delta = gamma - this.gamma0
    const { deadzone, amplitude, exponent } = this.params
    const abs = Math.abs(delta)
    if (abs <= deadzone) {
      this.rawCmd = 0
    } else {
      const n = Math.min((abs - deadzone) / (amplitude - deadzone), 1)
      this.rawCmd = Math.sign(delta) * Math.pow(n, exponent)
    }
    this.usingTouch = false
  }

  onTouchStart(x: number): void {
    this.touchStartX = x
  }

  onTouchMove(x: number, w: number): void {
    if (this.touchStartX === null) return
    if (this.tiltActive) return
    this.touchCmd = Math.max(-1, Math.min(1, (x - this.touchStartX) / (w * 0.4)))
    this.usingTouch = true
  }

  onTouchEnd(): void {
    this.touchStartX = null
    this.touchCmd = 0
    this.usingTouch = false
  }

  update(): number {
    const raw = this.usingTouch ? this.touchCmd : this.rawCmd
    this.smoothed = this.params.alpha * raw + (1 - this.params.alpha) * this.smoothed
    return this.smoothed
  }

  getCurrentGamma(): number {
    return this.lastGamma
  }
}

// ---------------------------------------------------------------------------
// GameState types
// ---------------------------------------------------------------------------

export type Phase =
  | 'pre_game'   // overlay "toucher pour commencer" (tilt permission)
  | 'serving'    // my ball on my paddle, waiting for tap
  | 'playing'    // ball in my half, I simulate
  | 'dead_zone'  // ball left top, in transit
  | 'waiting'    // ball in opponent's half
  | 'scoring'    // pause after a point
  | 'game_over'

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Paddle {
  x: number
}

export interface GameState {
  phase: Phase
  ball: Ball | null
  myScore: number
  opponentScore: number
  myRole: 'A' | 'B'
  serverOffset: number
  rallyCount: number
  ballArrivalTime: number | null  // local timestamp when ball should appear at top
  scoringUntil: number | null     // local timestamp end of point pause
}
