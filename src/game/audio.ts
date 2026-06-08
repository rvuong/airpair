let ctx: AudioContext | null = null

export function resumeAudio(): void {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
}

export function isMuted(): boolean {
  return ctx === null || ctx.state !== 'running'
}

function tone(
  freq: number,
  gainPeak: number,
  decay: number,
  delay = 0,
  type: OscillatorType = 'sine'
): void {
  if (!ctx || ctx.state !== 'running') return
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.connect(env)
  env.connect(ctx.destination)
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + delay
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(gainPeak, t0 + 0.004)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + decay)
  osc.start(t0)
  osc.stop(t0 + decay + 0.01)
}

// Countdown tick — 3, 2, 1
export function playCountdownTick(): void {
  tone(480, 0.40, 0.08)
}

// Countdown GO!
export function playCountdownGo(): void {
  tone(600, 0.50, 0.10)
  tone(800, 0.45, 0.18, 0.10)
}

// Ball hits paddle — "tock"
export function playHit(): void {
  tone(340, 0.55, 0.07)
}

// Ball bounces off wall — lighter "tick"
export function playWall(): void {
  tone(520, 0.25, 0.04)
}

// Opponent missed — you scored
export function playScore(): void {
  tone(520, 0.40, 0.10)
  tone(660, 0.40, 0.18, 0.11)
}

// You missed — you lost the point (deep thud)
export function playMiss(): void {
  tone(90, 0.55, 0.30)
  tone(60, 0.45, 0.40, 0.18)
}

// Game won — ascending 3-note arpeggio
export function playVictory(): void {
  tone(440, 0.45, 0.14)
  tone(550, 0.45, 0.14, 0.15)
  tone(660, 0.45, 0.28, 0.30)
}

// Game lost — descending 2-note
export function playDefeat(): void {
  tone(300, 0.40, 0.18)
  tone(200, 0.40, 0.28, 0.17)
}
