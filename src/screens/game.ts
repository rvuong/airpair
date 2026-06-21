import { RoomClient, GameMsg } from '../net/ws'
import { TiltController, GameState, Phase } from '../game/simulation'
import { resumeAudio, isMuted, playHit, playWall, playScore, playMiss, playVictory, playDefeat } from '../game/audio'
import { Theme, getThemeById, unlockNext, drawThemeIcon } from '../game/themes'
import {
  DEAD_ZONE_MS,
  INITIAL_SPEED_NORM,
  SPEED_LERP,
  MAX_SPEED_NORM,
  BALL_RADIUS_NORM,
  PADDLE_WIDTH_NORM,
  PADDLE_HEIGHT,
  PADDLE_MARGIN,
  PADDLE_CORNER,
  MAX_BOUNCE_ANGLE_DEG,
  POINT_PAUSE_MS,
  WIN_SCORE,
  WIN_MARGIN,
} from '../game/constants'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle: string
): void {
  ctx.fillStyle = fillStyle
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function determineServer(
  myScore: number,
  opponentScore: number,
  role: 'A' | 'B'
): boolean {
  const total = myScore + opponentScore
  const serverIsA = Math.floor(total / 2) % 2 === 0
  return (serverIsA && role === 'A') || (!serverIsA && role === 'B')
}

function checkWinner(
  myScore: number,
  opponentScore: number
): 'me' | 'opponent' | null {
  if (myScore >= WIN_SCORE && myScore - opponentScore >= WIN_MARGIN) return 'me'
  if (opponentScore >= WIN_SCORE && opponentScore - myScore >= WIN_MARGIN) return 'opponent'
  return null
}


// ---------------------------------------------------------------------------
// Approach indicator + spawn animation (D06)
// ---------------------------------------------------------------------------
const APPROACH_GAP_MS = 100  // void between dot disappearance and ball arrival
const BALL_SPAWN_MS   = 80   // ball scale-up duration on spawn

// ---------------------------------------------------------------------------
// Squash & stretch (D25)
// ---------------------------------------------------------------------------
const SQUASH_MS      = 150   // total animation duration
const SQUASH_SCALE   = 0.65  // scale on impact axis at peak
const STRETCH_SCALE  = 1.3   // scale on perpendicular axis at peak
const OVERSHOOT      = 1.08  // elastic overshoot (1 rebound)

function squashScales(elapsed: number): { sa: number; sb: number } {
  if (elapsed >= SQUASH_MS) return { sa: 1, sb: 1 }
  const T1 = 60, T2 = 120
  if (elapsed < T1) {
    const p = elapsed / T1
    return { sa: SQUASH_SCALE + (1 - SQUASH_SCALE) * p, sb: STRETCH_SCALE + (1 - STRETCH_SCALE) * p }
  } else if (elapsed < T2) {
    const p = (elapsed - T1) / (T2 - T1)
    return { sa: 1 + (OVERSHOOT - 1) * p, sb: 1 + (1 / OVERSHOOT - 1) * p }
  } else {
    const p = (elapsed - T2) / (SQUASH_MS - T2)
    return { sa: OVERSHOOT + (1 - OVERSHOOT) * p, sb: 1 / OVERSHOOT + (1 - 1 / OVERSHOOT) * p }
  }
}

// ---------------------------------------------------------------------------
// Main renderGame
// ---------------------------------------------------------------------------

export function renderGame(
  container: HTMLElement,
  client: RoomClient,
  role: 'A' | 'B',
  serverOffset: number,
  themeId: string,
  onBack: () => void
): () => void {
  // Build DOM: canvas + pre-game overlay
  container.innerHTML = `
    <canvas id="game-canvas" style="position:fixed;top:0;left:0;touch-action:none;"></canvas>
    <div id="pre-overlay" style="
      position:fixed;inset:0;z-index:10;
      background:rgba(0,0,0,0.85);
      display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:20px;
    ">
      <p style="
        color:rgba(255,255,255,0.55);font-size:30px;
        font-family:-apple-system,sans-serif;margin:0;
      ">7 pts · marge 2</p>
      <button id="start-btn" style="
        background:#f5f5f5;color:#111;border:none;border-radius:16px;
        padding:20px 40px;font-size:20px;font-weight:700;
        font-family:-apple-system,sans-serif;cursor:pointer;
        -webkit-tap-highlight-color:transparent;touch-action:manipulation;
      ">Toucher pour commencer</button>
      <p id="perm-msg" style="
        display:none;color:#ffcc00;font-size:28px;
        font-family:-apple-system,sans-serif;text-align:center;padding:0 32px;
      "></p>
    </div>
    <div id="landscape-warning" style="
      position:fixed;inset:0;z-index:20;
      background:#000;
      display:none;align-items:center;justify-content:center;
    ">
      <p style="color:#fff;font-size:18px;font-family:-apple-system,sans-serif;text-align:center;padding:32px;">
        Tournez votre téléphone en portrait
      </p>
    </div>
  `

  const canvas = container.querySelector<HTMLCanvasElement>('#game-canvas')!
  const preOverlay = container.querySelector<HTMLElement>('#pre-overlay')
  const startBtn = container.querySelector<HTMLButtonElement>('#start-btn')
  const permMsg = container.querySelector<HTMLElement>('#perm-msg')
  const landscapeWarning = container.querySelector<HTMLElement>('#landscape-warning')

  if (!canvas) throw new Error('Missing game canvas')
  const ctx = canvas.getContext('2d')!
  if (!ctx) throw new Error('Cannot get 2d context')

  // Canvas dimensions (CSS pixels)
  let W = window.innerWidth
  let H = window.innerHeight
  let BALL_R = W * BALL_RADIUS_NORM
  let paddleWidth = W * PADDLE_WIDTH_NORM

  function safeAreaTop(): number {
    // env(safe-area-inset-top) exposed as --sat in :root (index.html).
    // In PWA standalone + viewport-fit=cover, this equals the status bar height (~44px on iPhone 11).
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0
  }

  function resizeCanvas(): void {
    const sat = safeAreaTop()
    W = window.innerWidth
    H = window.innerHeight - sat
    BALL_R = W * BALL_RADIUS_NORM
    paddleWidth = W * PADDLE_WIDTH_NORM

    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    canvas.style.top = `${sat}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resizeCanvas()

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const state: GameState = {
    phase: 'pre_game',
    ball: null,
    myScore: 0,
    opponentScore: 0,
    myRole: role,
    serverOffset,
    rallyCount: 0,
    ballArrivalTime: null,
    scoringUntil: null,
  }

  // Theme (mutable: B updates it on game_start relay)
  let theme: Theme = getThemeById(themeId)
  let unlockedTheme: Theme | null = null
  let themeAlreadyUnlocked = false

  const tilt = new TiltController({ deadzone: 1.5, amplitude: 15, exponent: 1.1, alpha: 0.45 })
  let paddleX = W / 2 - paddleWidth / 2
  let serviceSpeedNorm = INITIAL_SPEED_NORM
  let lastImpact: { time: number; axis: 'x' | 'y' } | null = null
  let ballSpawnTime: number | null = null
  let nowMs = 0
  const paddleY = (): number => H - PADDLE_MARGIN

  // ---------------------------------------------------------------------------
  // Wake lock
  // ---------------------------------------------------------------------------
  let wakeLock: WakeLockSentinel | null = null
  async function requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen')
      }
    } catch {
      // Not critical
    }
  }

  // ---------------------------------------------------------------------------
  // Orientation sensor
  // ---------------------------------------------------------------------------
  let tiltListening = false
  let tiltCalibrated = false
  const dbg = { evts: 0, gamma: 0, cmd: 0, perm: '?' }

  function onOrientation(e: DeviceOrientationEvent): void {
    if (e.gamma === null) return
    dbg.evts++
    dbg.gamma = e.gamma
    if (!tiltCalibrated) {
      tilt.calibrate(e.gamma)
      tiltCalibrated = true
    }
    tilt.onDeviceOrientation(e.gamma)
  }

  function startTiltListener(): void {
    if (tiltListening) return
    tiltListening = true
    window.addEventListener('deviceorientation', onOrientation)
  }

  // ---------------------------------------------------------------------------
  // Serving helper
  // ---------------------------------------------------------------------------
  function placeBallOnPaddle(): void {
    const py = paddleY()
    state.ball = {
      x: paddleX + paddleWidth / 2,
      y: py - BALL_R,
      vx: 0,
      vy: 0,
    }
  }

  function serveBall(): void {
    if (state.phase !== 'serving' || !state.ball) return
    state.ball.vy = -(H * serviceSpeedNorm)
    state.ball.vx = (Math.random() * 0.4 - 0.2) * W * serviceSpeedNorm
    state.phase = 'playing'
    state.rallyCount = 0
  }

  // Alternates each game: A serves odd games, B serves even games
  let firstServer: 'A' | 'B' = 'A'

  function resetGame(): void {
    firstServer = firstServer === 'A' ? 'B' : 'A'
    state.myScore = 0
    state.opponentScore = 0
    state.rallyCount = 0
    serviceSpeedNorm = INITIAL_SPEED_NORM
    state.ball = null
    state.ballArrivalTime = null
    state.scoringUntil = null
    pendingHit = null
    lastImpact = null
    unlockedTheme = null
    themeAlreadyUnlocked = false
    if (firstServer === role) {
      state.phase = 'serving'
      placeBallOnPaddle()
    } else {
      state.phase = 'waiting'
    }
  }

  function afterScoring(): void {
    serviceSpeedNorm = serviceSpeedNorm + (MAX_SPEED_NORM - serviceSpeedNorm) * SPEED_LERP
    const iServe = determineServer(state.myScore, state.opponentScore, role)
    if (iServe) {
      state.phase = 'serving'
      placeBallOnPaddle()
    } else {
      state.phase = 'waiting'
      state.ball = null
    }
  }

  // ---------------------------------------------------------------------------
  // Relay message handling
  // ---------------------------------------------------------------------------
  client.onRelay = (payload: unknown) => {
    const msg = payload as GameMsg

    if (msg.type === 'hit') {
      // Compute local arrival time from server timestamp
      const tArriveLocal = (msg.t_exit + DEAD_ZONE_MS) - serverOffset
      state.ballArrivalTime = tArriveLocal

      // Store hit params to set ball position when it arrives
      pendingHit = { nx: msg.nx, nvx: msg.nvx, nvy: msg.nvy }

      // Switch to waiting if we were in dead_zone or already waiting
      if (state.phase === 'dead_zone' || state.phase === 'waiting') {
        state.phase = 'waiting'
      }
    } else if (msg.type === 'game_start') {
      if (role === 'B') {
        if (msg.themeId) theme = getThemeById(msg.themeId)
        activateGame()
      }
    } else if (msg.type === 'rematch') {
      resetGame()
    } else if (msg.type === 'miss') {
      if (msg.scorer === role) {
        state.myScore++
      } else {
        state.opponentScore++
      }
      state.phase = 'scoring'
      state.scoringUntil = Date.now() + POINT_PAUSE_MS
      if (msg.scorer === role) playScore(); else playMiss()
    }
  }

  // Pending incoming hit parameters
  let pendingHit: { nx: number; nvx: number; nvy: number } | null = null

  // ---------------------------------------------------------------------------
  // Pre-game overlay handler
  // ---------------------------------------------------------------------------
  function activateGame(): void {
    if (preOverlay) preOverlay.style.display = 'none'
    startTiltListener()
    requestWakeLock().catch(() => { /* non-critical */ })
    if (role === 'A') {
      state.phase = 'serving'
      placeBallOnPaddle()
    } else {
      state.phase = 'waiting'
      state.ball = null
    }
  }

  // ---------------------------------------------------------------------------
  // RAF loop
  // ---------------------------------------------------------------------------
  let rafId = 0
  let lastTime = 0
  let suspended = false

  function loop(now: number): void {
    if (suspended) return
    nowMs = now

    const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now

    update(dt)
    draw()

    rafId = requestAnimationFrame(loop)
  }

  function update(dt: number): void {
    const py = paddleY()

    // Animate paddle in all active phases
    if (
      state.phase === 'serving' ||
      state.phase === 'playing' ||
      state.phase === 'waiting' ||
      state.phase === 'dead_zone'
    ) {
      const cmd = tilt.update()
      dbg.cmd = cmd
      paddleX += cmd * W * 2.2 * dt
      paddleX = Math.max(0, Math.min(W - paddleWidth, paddleX))
    }

    // Keep ball glued to paddle during serve
    if (state.phase === 'serving' && state.ball) {
      state.ball.x = paddleX + paddleWidth / 2
      state.ball.y = py - BALL_R
    }

    // Physics
    if (state.phase === 'playing' && state.ball) {
      const ball = state.ball

      ball.x += ball.vx * dt
      ball.y += ball.vy * dt

      // Wall bounces
      if (ball.x - BALL_R < 0) {
        ball.x = BALL_R
        ball.vx = Math.abs(ball.vx)
        lastImpact = { time: nowMs, axis: 'x' }
        playWall()
      } else if (ball.x + BALL_R > W) {
        ball.x = W - BALL_R
        ball.vx = -Math.abs(ball.vx)
        lastImpact = { time: nowMs, axis: 'x' }
        playWall()
      }

      // Paddle hit detection
      if (
        ball.vy > 0 &&
        ball.y + BALL_R >= py &&
        ball.y - BALL_R <= py + PADDLE_HEIGHT &&
        ball.x >= paddleX - BALL_R &&
        ball.x <= paddleX + paddleWidth + BALL_R
      ) {
        // Compute speed
        const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
        const newSpeed = currentSpeed + (MAX_SPEED_NORM * H - currentSpeed) * SPEED_LERP
        state.rallyCount++

        // Angle based on relative position on paddle
        const relativeHit = (ball.x - paddleX) / paddleWidth  // 0..1
        const normalised = relativeHit * 2 - 1                 // -1..1
        const angle = normalised * (MAX_BOUNCE_ANGLE_DEG * Math.PI / 180)

        ball.vx = newSpeed * Math.sin(angle)
        ball.vy = -Math.abs(newSpeed * Math.cos(angle))
        ball.y = py - BALL_R
        lastImpact = { time: nowMs, axis: 'y' }
        playHit()
      }

      // Ball exits top — send hit relay
      if (ball.y + BALL_R < 0) {
        const t_exit = Date.now() + serverOffset
        const nx = ball.x / W
        const nvx = ball.vx / W
        const nvy = Math.abs(ball.vy) / H

        const hitMsg: GameMsg = { type: 'hit', t_exit, nx, nvx, nvy }
        client.relay(hitMsg)

        state.phase = 'dead_zone'
        state.ball = null
      }

      // Ball exits bottom — miss
      if (state.ball && state.ball.y - BALL_R > H) {
        const opponentRole: 'A' | 'B' = role === 'A' ? 'B' : 'A'
        const missMsg: GameMsg = { type: 'miss', scorer: opponentRole }
        client.relay(missMsg)

        state.opponentScore++
        state.phase = 'scoring'
        state.scoringUntil = Date.now() + POINT_PAUSE_MS
        state.ball = null
        playMiss()
      }
    }

    // Dead zone → waiting once enough time has elapsed
    if (state.phase === 'dead_zone') {
      // We become 'waiting' once the DEAD_ZONE_MS has passed on the server clock.
      // Without a stored t_exit we just rely on the relay arrival.
      // The phase transitions to waiting when we receive the relay 'hit' from opponent.
      // However if we sent our own hit we already moved to dead_zone;
      // transition to waiting passively (opponent will relay their hit later).
      // Nothing more to do here — waiting for relay.
    }

    // Waiting — check if ball arrival time has come
    if (state.phase === 'waiting' && state.ballArrivalTime !== null && pendingHit !== null) {
      if (Date.now() >= state.ballArrivalTime) {
        const { nx, nvx, nvy } = pendingHit
        const speed = nvy * H

        state.ball = {
          x: (1 - nx) * W,
          y: 0 + BALL_R,
          vx: -nvx * W,
          vy: speed,
        }
        state.phase = 'playing'
        state.ballArrivalTime = null
        pendingHit = null
        ballSpawnTime = nowMs
      }
    }

    // Scoring pause
    if (state.phase === 'scoring' && state.scoringUntil !== null) {
      if (Date.now() >= state.scoringUntil) {
        state.scoringUntil = null

        // Check win
        const winner = checkWinner(state.myScore, state.opponentScore)
        if (winner) {
          state.phase = 'game_over'
          if (winner === 'me') {
            playVictory()
            if (!themeAlreadyUnlocked) {
              unlockedTheme = unlockNext()
              themeAlreadyUnlocked = true
            }
          } else {
            playDefeat()
          }
        } else {
          afterScoring()
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------
  function drawCourtLines(): void {
    const M = 8
    ctx.save()
    ctx.strokeStyle = theme.lineColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(M, 0);         ctx.lineTo(M, H - M)
    ctx.moveTo(W - M, 0);     ctx.lineTo(W - M, H - M)
    ctx.moveTo(M, H - M);     ctx.lineTo(W - M, H - M)
    ctx.moveTo(W / 2, 0);     ctx.lineTo(W / 2, H - M)
    ctx.stroke()
    ctx.restore()
  }

  function drawGazonStripes(): void {
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, W, H)
    const n = 8
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2d6a2d' : '#3a7a3a'
      ctx.fillRect(0, i * (H / n), W, Math.ceil(H / n) + 1)
    }
  }

  function draw(): void {
    const py = paddleY()

    ctx.clearRect(0, 0, W, H)

    // Background
    if (theme.stripedBg) {
      drawGazonStripes()
    } else {
      ctx.fillStyle = theme.bg
      ctx.fillRect(0, 0, W, H)
    }

    // Court lines (won themes only)
    if (theme.courtLines) drawCourtLines()

    // Score + dashed line with typographic knockout around it
    // measureText() requires the font to be set first, so font is set before the line.
    // actualBoundingBoxAscent gives the exact distance from baseline to top of rendered glyphs,
    // which lets us place the line at the true vertical mid-point of the score text.
    const scoreText = `${state.myScore} – ${state.opponentScore}`
    const scoreY = H * 0.055
    const knockoutMargin = 16  // px clearance on each side of the score

    ctx.font = `bold ${Math.round(W * 0.09)}px -apple-system, sans-serif`
    const metrics = ctx.measureText(scoreText)
    const textW = metrics.width
    const lineY = scoreY - metrics.actualBoundingBoxAscent / 2
    const gapLeft  = W / 2 - textW / 2 - knockoutMargin
    const gapRight = W / 2 + textW / 2 + knockoutMargin

    ctx.save()
    ctx.setLineDash([6, 8])
    ctx.strokeStyle = theme.lineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, lineY)
    ctx.lineTo(gapLeft, lineY)
    ctx.moveTo(gapRight, lineY)
    ctx.lineTo(W, lineY)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(scoreText, W / 2, scoreY)

    // Paddle
    const paddleColor = role === 'A' ? theme.paddleA : theme.paddleB
    drawRoundedRect(ctx, paddleX, py, paddleWidth, PADDLE_HEIGHT, PADDLE_CORNER, paddleColor)

    // Ball (with squash & stretch on impact — D25, and spawn scale — D06)
    if (state.ball) {
      const spawnElapsed = ballSpawnTime !== null ? nowMs - ballSpawnTime : Infinity
      const ss = spawnElapsed < BALL_SPAWN_MS ? 1.3 - 0.3 * (spawnElapsed / BALL_SPAWN_MS) : 1.0
      let rx = BALL_R * ss
      let ry = BALL_R * ss
      if (lastImpact !== null) {
        const { sa, sb } = squashScales(nowMs - lastImpact.time)
        if (lastImpact.axis === 'y') { rx = BALL_R * sb * ss; ry = BALL_R * sa * ss }
        else                          { rx = BALL_R * sa * ss; ry = BALL_R * sb * ss }
      }
      ctx.fillStyle = theme.ball
      ctx.beginPath()
      ctx.ellipse(state.ball.x, state.ball.y, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Approach indicator — shrinking white dot, disappears 100 ms before ball (D06 option B)
    if (pendingHit !== null && state.ballArrivalTime !== null) {
      const remaining = Math.max(0, state.ballArrivalTime - Date.now())
      if (remaining > APPROACH_GAP_MS) {
        const progress = Math.min(1, 1 - (remaining - APPROACH_GAP_MS) / (DEAD_ZONE_MS - APPROACH_GAP_MS))
        const ix = (1 - pendingHit.nx) * W
        const ir = BALL_R * (1.5 - progress)
        const alpha = 0.25 + 0.75 * progress
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
        ctx.beginPath()
        ctx.arc(ix, BALL_R, ir, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Phase overlays
    const phase: Phase = state.phase

    if (phase === 'waiting' || phase === 'dead_zone') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = `${Math.round(W * 0.08)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Adversaire…', W / 2, H - PADDLE_MARGIN - PADDLE_HEIGHT / 2 - 16)
    }

    if (phase === 'serving') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `${Math.round(W * 0.08)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Tap pour servir', W / 2, H - PADDLE_MARGIN - PADDLE_HEIGHT / 2 - 16)
    }


    if (phase === 'scoring') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, 0, W, H)
    }

    // Mute switch warning (iOS silent mode cuts Web Audio)
    if (isMuted() && phase !== 'pre_game') {
      ctx.fillStyle = 'rgba(255,200,0,0.85)'
      ctx.font = `${Math.round(W * 0.066)}px -apple-system, sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText('Son coupé', W - 10, H * 0.055)
    }

    if (phase === 'game_over') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(0, 0, W, H)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const revanBtnH = W * 0.13
      const retourBtnH = W * 0.11
      // When a theme is unlocked, reserve extra vertical space for the badge
      const badgeH = unlockedTheme ? W * 0.1 + 56 + W * 0.06 : 0
      const blockH = W * 0.50 + badgeH
      const blockTop = H / 2 - blockH / 2

      const titleY   = blockTop + W * 0.045
      const scoreY   = titleY   + W * 0.105
      const btnX     = W / 2 - W * 0.3
      const btnW     = W * 0.6

      const txt = state.myScore > state.opponentScore ? 'Victoire !' : 'Défaite'
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(W * 0.09)}px -apple-system, sans-serif`
      ctx.fillText(txt, W / 2, titleY)

      ctx.font = `${Math.round(W * 0.06)}px -apple-system, sans-serif`
      ctx.fillText(`${state.myScore} – ${state.opponentScore}`, W / 2, scoreY)

      // Theme unlock badge (winner only)
      let revanTop = scoreY + W * 0.085
      if (unlockedTheme) {
        const iconW = 40, iconH = 54
        const iconX = W / 2 - iconW / 2
        const iconTop = scoreY + W * 0.07
        drawThemeIcon(ctx, unlockedTheme, iconX, iconTop, iconW, iconH, false)
        const badgeTextY = iconTop + iconH + W * 0.05
        ctx.fillStyle = '#ffe600'
        ctx.font = `bold ${Math.round(W * 0.053)}px -apple-system, sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(`Thème ${unlockedTheme.name} débloqué !`, W / 2, badgeTextY)
        ctx.textBaseline = 'middle'
        revanTop = badgeTextY + W * 0.07
      }

      const retourTop = revanTop + revanBtnH + W * 0.04

      // Revanche button (primary)
      ctx.fillStyle = '#fff'
      roundedRectPath(ctx, btnX, revanTop, btnW, revanBtnH, 12)
      ctx.fill()
      ctx.fillStyle = '#000'
      ctx.font = `bold ${Math.round(W * 0.075)}px -apple-system, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText('Revanche', W / 2, revanTop + revanBtnH / 2)

      // Back button (secondary)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1.5
      roundedRectPath(ctx, btnX, retourTop, btnW, retourBtnH, 12)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = `${Math.round(W * 0.065)}px -apple-system, sans-serif`
      ctx.fillText('Retour', W / 2, retourTop + retourBtnH / 2)

      ctx.textBaseline = 'alphabetic'
    }
  }

  // ---------------------------------------------------------------------------
  // Input event handlers
  // ---------------------------------------------------------------------------

  function getCanvasX(clientX: number): number {
    return clientX
  }

  function handleTouchStart(e: TouchEvent): void {
    resumeAudio()
    const touch = e.changedTouches[0]
    if (!touch) return
    const x = getCanvasX(touch.clientX)

    tilt.onTouchStart(x)

    if (state.phase === 'serving') {
      serveBall()
    } else if (state.phase === 'game_over') {
      e.preventDefault()  // suppress the synthetic click that would fire serveBall()
      checkGameOverTap(touch.clientX, touch.clientY)
    }
  }

  function handleTouchMove(e: TouchEvent): void {
    e.preventDefault()
    const touch = e.changedTouches[0]
    if (!touch) return
    tilt.onTouchMove(getCanvasX(touch.clientX), W)
  }

  function handleTouchEnd(): void {
    tilt.onTouchEnd()
  }

  function handleMouseMove(e: MouseEvent): void {
    if (state.phase === 'pre_game' || state.phase === 'game_over') return
    paddleX = Math.max(0, Math.min(W - paddleWidth, e.clientX - paddleWidth / 2))
  }

  function handleClick(e: MouseEvent): void {
    if (state.phase === 'serving') {
      serveBall()
    } else if (state.phase === 'game_over') {
      checkGameOverTap(e.clientX, e.clientY)
    }
  }

  function checkGameOverTap(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect()
    const cx = clientX - rect.left
    const cy = clientY - rect.top

    const revanBtnH  = W * 0.13
    const retourBtnH = W * 0.11
    const badgeH = unlockedTheme ? W * 0.1 + 56 + W * 0.06 : 0
    const blockH = W * 0.50 + badgeH
    const blockTop = H / 2 - blockH / 2
    const scoreY   = blockTop + W * 0.045 + W * 0.105
    let revanTop = scoreY + W * 0.085
    if (unlockedTheme) {
      const iconH = 54
      const iconTop = scoreY + W * 0.07
      const badgeTextY = iconTop + iconH + W * 0.05
      revanTop = badgeTextY + W * 0.07
    }
    const retourTop = revanTop + revanBtnH + W * 0.04
    const btnX = W / 2 - W * 0.3
    const btnW = W * 0.6

    if (cy >= revanTop && cy <= revanTop + revanBtnH &&
        cx >= btnX && cx <= btnX + btnW) {
      client.relay({ type: 'rematch' } satisfies GameMsg)
      resetGame()
      return
    }
    if (cy >= retourTop && cy <= retourTop + retourBtnH &&
        cx >= btnX && cx <= btnX + btnW) {
      onBack()
    }
  }

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
  canvas.addEventListener('touchend', handleTouchEnd)
  canvas.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('click', handleClick)

  // Pre-game overlay — real <button> + click + async/await: the only pattern iOS 13+ accepts
  const handleStartBtn = async (): Promise<void> => {
    resumeAudio()
    startBtn!.disabled = true
    const DevOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    if (typeof DevOrient.requestPermission === 'function') {
      try {
        const result = await DevOrient.requestPermission()
        dbg.perm = result
        if (result === 'granted') {
          client.relay({ type: 'game_start', themeId: theme.id } satisfies GameMsg)
          activateGame()
        } else {
          if (permMsg) {
            permMsg.style.display = 'block'
            permMsg.textContent = 'Permission refusée. Réglages → Safari → Mouvement et orientation → activer, puis recharger.'
          }
          startBtn!.disabled = false
        }
      } catch (err: unknown) {
        dbg.perm = String(err).slice(-50)
        client.relay({ type: 'game_start', themeId: theme.id } satisfies GameMsg)
        activateGame()
      }
    } else {
      dbg.perm = 'no-api'
      client.relay({ type: 'game_start', themeId: theme.id } satisfies GameMsg)
      activateGame()
    }
  }

  startBtn?.addEventListener('click', handleStartBtn)

  // Player B — adapt overlay, wait for game_start relay from A
  if (role === 'B') {
    if (startBtn) startBtn.style.display = 'none'

    const waitMsg = document.createElement('p')
    waitMsg.textContent = 'En attente du joueur A…'
    waitMsg.style.cssText = `
      color:rgba(255,255,255,0.55);font-size:30px;
      font-family:-apple-system,sans-serif;margin:0;
    `
    preOverlay?.appendChild(waitMsg)

    // iOS only — request tilt permission while waiting
    const DevOrient = DeviceOrientationEvent as unknown as { requestPermission?: unknown }
    if (typeof DevOrient.requestPermission === 'function') {
      const tiltBtn = document.createElement('button')
      tiltBtn.textContent = 'Incliner pour jouer'
      tiltBtn.style.cssText = `
        background:rgba(255,255,255,0.15);color:#fff;
        border:1px solid rgba(255,255,255,0.35);border-radius:10px;
        padding:12px 24px;font-size:30px;font-family:-apple-system,sans-serif;
        cursor:pointer;-webkit-tap-highlight-color:transparent;margin-top:8px;
      `
      const tiltHint = document.createElement('p')
      tiltHint.textContent = '(le toucher fonctionne aussi)'
      tiltHint.style.cssText = `
        color:rgba(255,255,255,0.35);font-size:22px;
        font-family:-apple-system,sans-serif;margin:0;
      `
      preOverlay?.appendChild(tiltBtn)
      preOverlay?.appendChild(tiltHint)

      tiltBtn.addEventListener('click', async () => {
        resumeAudio()
        tiltBtn.remove()
        tiltHint.remove()
        const DoeCtor = DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<'granted' | 'denied'>
        }
        try {
          const result = await DoeCtor.requestPermission()
          dbg.perm = result
          if (result === 'granted') {
            startTiltListener()
          } else {
            const msg = document.createElement('p')
            msg.textContent = 'Inclinaison non autorisée — Contrôle au doigt actif'
            msg.style.cssText = `
              color:rgba(255,255,255,0.45);font-size:24px;
              font-family:-apple-system,sans-serif;text-align:center;padding:0 32px;
            `
            preOverlay?.appendChild(msg)
          }
        } catch (err: unknown) {
          dbg.perm = String(err).slice(-30)
          startTiltListener()
        }
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Landscape detection
  // ---------------------------------------------------------------------------
  function checkOrientation(): void {
    if (!landscapeWarning) return
    const isLandscape = window.innerWidth > window.innerHeight
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    landscapeWarning.style.display = (isLandscape && isTouchDevice) ? 'flex' : 'none'
  }

  checkOrientation()

  // ---------------------------------------------------------------------------
  // Resize handler
  // ---------------------------------------------------------------------------
  function handleResize(): void {
    resizeCanvas()
    // Re-clamp paddle
    paddleX = Math.max(0, Math.min(W - paddleWidth, paddleX))
    checkOrientation()
  }

  window.addEventListener('resize', handleResize)

  // ---------------------------------------------------------------------------
  // Visibility / background suspension
  // ---------------------------------------------------------------------------
  function handleVisibilityChange(): void {
    if (document.hidden) {
      suspended = true
      cancelAnimationFrame(rafId)
      rafId = 0
    } else {
      if (!suspended) return
      suspended = false
      lastTime = 0
      rafId = requestAnimationFrame(loop)
      // Re-acquire wake lock if needed
      requestWakeLock().catch(() => {/* ignore */})
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // ---------------------------------------------------------------------------
  // Start loop
  // ---------------------------------------------------------------------------
  rafId = requestAnimationFrame(loop)

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId)

    canvas.removeEventListener('touchstart', handleTouchStart)
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleTouchEnd)
    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('click', handleClick)

    startBtn?.removeEventListener('click', handleStartBtn)

    window.removeEventListener('resize', handleResize)
    document.removeEventListener('visibilitychange', handleVisibilityChange)

    if (tiltListening) {
      window.removeEventListener('deviceorientation', onOrientation)
    }

    wakeLock?.release().catch(() => {/* ignore */})

    client.disconnect()
    container.innerHTML = ''
  }
}
