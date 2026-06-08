import { renderLanding } from './screens/landing.ts'
import { renderHost } from './screens/host.ts'
import { renderJoin } from './screens/join.ts'
import { renderGame } from './screens/game.ts'
import { RoomClient } from './net/ws.ts'

// ---------------------------------------------------------------------------
// iOS Safari: prevent scroll/bounce on all touchmove events
// ---------------------------------------------------------------------------
document.addEventListener('touchmove', (e: TouchEvent) => {
  e.preventDefault()
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

type GameParams = { client: RoomClient; role: 'A' | 'B'; serverOffset: number }

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
        (c, r, o) => navigate('game', { client: c, role: r, serverOffset: o }))
      break

    case 'join':
      currentDestroy = renderJoin(app, () => navigate('landing'),
        (c, r, o) => navigate('game', { client: c, role: r, serverOffset: o }))
      break

    case 'game': {
      // params is required for 'game' — enforced by overload signatures
      const p = params as GameParams
      currentDestroy = renderGame(app, p.client, p.role, p.serverOffset,
        () => navigate('landing'))
      break
    }
  }
}

// Boot on landing
navigate('landing')
