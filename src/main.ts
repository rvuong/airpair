import { renderLanding } from './screens/landing.ts'
import { renderHost } from './screens/host.ts'
import { renderJoin } from './screens/join.ts'
import { renderGame, CaptureOptions } from './screens/game.ts'
import { RoomClient } from './net/ws.ts'

// ---------------------------------------------------------------------------
// iOS Safari: prevent scroll/bounce except inside scrollable pre-game screens
// ---------------------------------------------------------------------------
document.addEventListener('touchmove', (e: TouchEvent) => {
  if (!(e.target as HTMLElement).closest('.screen')) {
    e.preventDefault()
  }
}, { passive: false })

// ---------------------------------------------------------------------------
// App container
// ---------------------------------------------------------------------------
function getAppElement(): HTMLElement {
  const el = document.getElementById('app')
  if (!el) throw new Error('Missing #app element')
  return el
}

const app: HTMLElement = getAppElement()

// ---------------------------------------------------------------------------
// Router — each render function returns a destroy() for cleanup
// ---------------------------------------------------------------------------
type Destroy = () => void
let currentDestroy: Destroy | null = null

type GameParams = { client: RoomClient; role: 'A' | 'B'; serverOffset: number; themeId: string }

function navigate(screen: 'landing' | 'host' | 'join'): void
function navigate(screen: 'game', params: GameParams): void
function navigate(screen: 'landing' | 'host' | 'join' | 'game', params?: GameParams): void {
  currentDestroy?.()
  currentDestroy = null

  switch (screen) {
    case 'landing':
      currentDestroy = renderLanding(app, (choice) => {
        navigate(choice === 'host' ? 'host' : 'join')
      })
      break

    case 'host':
      currentDestroy = renderHost(app, () => navigate('landing'),
        (c, r, o, t) => navigate('game', { client: c, role: r, serverOffset: o, themeId: t }))
      break

    case 'join':
      currentDestroy = renderJoin(app, () => navigate('landing'),
        (c, r, o, t) => navigate('game', { client: c, role: r, serverOffset: o, themeId: t }))
      break

    case 'game': {
      // params is required for 'game' — enforced by overload signatures
      const p = params as GameParams
      currentDestroy = renderGame(app, p.client, p.role, p.serverOffset, p.themeId,
        () => navigate('landing'))
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Capture harness entry (dev tool) — ?capture=approach produces PNGs of the
// D06 approach → spawn animation without needing a live opponent. See runCapture.
// ---------------------------------------------------------------------------
const q = new URLSearchParams(location.search)
if (q.get('capture')) {
  // Minimal stub: renderGame only assigns handler props before the capture
  // early-return; no client method is ever called in capture mode.
  const stubClient = {
    onCountdown: null,
    onRelay: null,
    onServerPong: null,
    connect: async () => {},
    relay: () => {},
    startCountdown: () => {},
    serverPing: () => {},
    disconnect: () => {},
  } as unknown as RoomClient

  currentDestroy = renderGame(app, stubClient, 'A', 0, q.get('theme') ?? 'arcade', () => {}, {
    scenario: 'approach',
    mode: (q.get('mode') as CaptureOptions['mode']) ?? 'triptych',
    t: q.has('t') ? Number(q.get('t')) : undefined,
    frames: q.get('frames') ? q.get('frames')!.split(',').map(Number) : undefined,
    labels: q.get('labels') === '1',
    step: q.has('step') ? Number(q.get('step')) : undefined,
    nx: q.has('nx') ? Number(q.get('nx')) : undefined,
    clean: q.get('clean') !== '0',
  })
} else {
  navigate('landing')
}
