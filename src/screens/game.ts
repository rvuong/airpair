import { RoomClient, GameMsg } from '../net/ws'
import { TiltController, GameState, Phase } from '../game/simulation'
import { resumeAudio, isMuted, playHit, playWall, playScore, playMiss, playVictory, playDefeat } from '../game/audio'
import {
  DEAD_ZONE_MS,
  INITIAL_SPEED_NORM,
  SPEED_FACTOR,
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
// Main renderGame
// ---------------------------------------------------------------------------

export function renderGame(
  container: HTMLElement,
  client: RoomClient,
  role: 'A' | 'B',
  serverOffset: number,
  onBack: () => void
): () => void {
  // Build DOM: canvas + pre-game overlay
  container.innerHTML = `
    <canvas id="game-canvas" style="display:block;touch-action:none;"></canvas>
    <div id="pre-overlay" style="
      position:fixed;inset:0;z-index:10;
      background:rgba(0,0,0,0.85);
      display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:20px;
    ">
      <button id="start-btn" style="
        background:#f5f5f5;color:#111;border:none;border-radius:16px;
        padding:20px 40px;font-size:20px;font-weight:700;
        font-family:-apple-system,sans-serif;cursor:pointer;
        -webkit-tap-highlight-color:transparent;touch-action:manipulation;
      ">Toucher pour commencer</button>
      <p id="perm-msg" style="
        display:none;color:#ffcc00;font-size:14px;
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

  function resizeCanvas(): void {
    W = window.innerWidth
    H = window.innerHeight
    BALL_R = W * BALL_RADIUS_NORM
    paddleWidth = W * PADDLE_WIDTH_NORM

    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
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

  const tilt = new TiltController({ deadzone: 1.5, amplitude: 20, exponent: 1.4, alpha: 0.3 })
  let paddleX = W / 2 - paddleWidth / 2
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
    state.ball.vy = -(H * INITIAL_SPEED_NORM)
    // Give a slight random horizontal component for first serve
    state.ball.vx = (Math.random() * 0.4 - 0.2) * W * INITIAL_SPEED_NORM
    state.phase = 'playing'
    state.rallyCount = 0
  }

  function afterScoring(): void {
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
      paddleX += cmd * W * 2.0 * dt
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
        playWall()
      } else if (ball.x + BALL_R > W) {
        ball.x = W - BALL_R
        ball.vx = -Math.abs(ball.vx)
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
        const newSpeed = Math.min(currentSpeed * SPEED_FACTOR, MAX_SPEED_NORM * H)
        state.rallyCount++

        // Angle based on relative position on paddle
        const relativeHit = (ball.x - paddleX) / paddleWidth  // 0..1
        const normalised = relativeHit * 2 - 1                 // -1..1
        const angle = normalised * (MAX_BOUNCE_ANGLE_DEG * Math.PI / 180)

        ball.vx = newSpeed * Math.sin(angle)
        ball.vy = -Math.abs(newSpeed * Math.cos(angle))
        ball.y = py - BALL_R
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
          if (winner === 'me') playVictory(); else playDefeat()
        } else {
          afterScoring()
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------
  function draw(): void {
    const py = paddleY()

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    // Central dashed line (near top — indicates "towards opponent")
    ctx.save()
    ctx.setLineDash([6, 8])
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, H * 0.05)
    ctx.lineTo(W, H * 0.05)
    ctx.stroke()
    ctx.restore()

    // Score
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(W * 0.09)}px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${state.myScore} – ${state.opponentScore}`, W / 2, H * 0.055)

    // Paddle
    drawRoundedRect(ctx, paddleX, py, paddleWidth, PADDLE_HEIGHT, PADDLE_CORNER, '#fff')

    // Ball
    if (state.ball) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2)
      ctx.fill()
    }

    // Phase overlays
    const phase: Phase = state.phase

    if (phase === 'waiting' || phase === 'dead_zone') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = `${Math.round(W * 0.04)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Adversaire…', W / 2, H - 20)
    }

    if (phase === 'serving') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `${Math.round(W * 0.04)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Tap pour servir', W / 2, H - 20)
    }


    if (phase === 'scoring') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, 0, W, H)
    }

    // Mute switch warning (iOS silent mode cuts Web Audio)
    if (isMuted() && phase !== 'pre_game') {
      ctx.fillStyle = 'rgba(255,200,0,0.85)'
      ctx.font = `${Math.round(W * 0.033)}px -apple-system, sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText('Son coupé', W - 10, H * 0.055)
    }

    if (phase === 'game_over') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(W * 0.12)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      const txt = state.myScore > state.opponentScore ? 'Victoire !' : 'Défaite'
      ctx.fillText(txt, W / 2, H / 2 - W * 0.06)

      ctx.font = `${Math.round(W * 0.07)}px -apple-system, sans-serif`
      ctx.fillText(`${state.myScore} – ${state.opponentScore}`, W / 2, H / 2 + W * 0.04)

      // Back button
      ctx.fillStyle = '#fff'
      roundedRectPath(ctx, W / 2 - W * 0.3, H * 0.62, W * 0.6, W * 0.13, 12)
      ctx.fill()
      ctx.fillStyle = '#000'
      ctx.font = `bold ${Math.round(W * 0.05)}px -apple-system, sans-serif`
      ctx.fillText('Retour', W / 2, H * 0.62 + W * 0.085)
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
      checkBackButtonTap(touch.clientX, touch.clientY)
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
      checkBackButtonTap(e.clientX, e.clientY)
    }
  }

  function checkBackButtonTap(clientX: number, clientY: number): void {
    // Back button bounds: x: W/2 - W*0.3 .. W/2 + W*0.3, y: H*0.62 .. H*0.62 + W*0.13
    const bx = W / 2 - W * 0.3
    const by = H * 0.62
    const bw = W * 0.6
    const bh = W * 0.13
    if (
      clientX >= bx && clientX <= bx + bw &&
      clientY >= by && clientY <= by + bh
    ) {
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
        activateGame()
      }
    } else {
      dbg.perm = 'no-api'
      activateGame()
    }
  }

  startBtn?.addEventListener('click', handleStartBtn)

  // Player B goes directly to waiting — no overlay interaction needed
  if (role === 'B') {
    activateGame()
    // Small non-blocking button to request tilt permission before the ball arrives
    const DevOrient = DeviceOrientationEvent as unknown as { requestPermission?: unknown }
    if (typeof DevOrient.requestPermission === 'function') {
      const tiltBtn = document.createElement('button')
      tiltBtn.id = 'tilt-btn'
      tiltBtn.textContent = 'Activer tilt'
      tiltBtn.style.cssText = `
        position:fixed;bottom:64px;right:16px;z-index:5;
        background:rgba(255,255,255,0.15);color:#fff;
        border:1px solid rgba(255,255,255,0.35);border-radius:10px;
        padding:10px 16px;font-size:14px;font-family:-apple-system,sans-serif;
        cursor:pointer;-webkit-tap-highlight-color:transparent;
      `
      container.appendChild(tiltBtn)

      const enableTilt = async (): Promise<void> => {
        resumeAudio()
        tiltBtn.remove()
        const DoeCtor = DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<'granted' | 'denied'>
        }
        try {
          const result = await DoeCtor.requestPermission()
          dbg.perm = result
          if (result === 'granted') startTiltListener()
        } catch (err: unknown) {
          dbg.perm = String(err).slice(-30)
        }
      }

      tiltBtn.addEventListener('click', enableTilt)
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
