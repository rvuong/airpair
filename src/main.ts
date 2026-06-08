import { renderLanding } from './screens/landing.ts'
import { renderHost } from './screens/host.ts'
import { renderJoin } from './screens/join.ts'
import { renderGame } from './screens/game.ts'

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

function navigate(screen: 'landing' | 'host' | 'join' | 'game'): void {
  currentDestroy?.()
  currentDestroy = null

  switch (screen) {
    case 'landing':
      currentDestroy = renderLanding(app, (choice) => {
        navigate(choice === 'host' ? 'host' : 'join')
      })
      break

    case 'host':
      currentDestroy = renderHost(app, () => navigate('landing'), () => navigate('game'))
      break

    case 'join':
      currentDestroy = renderJoin(app, () => navigate('landing'), () => navigate('game'))
      break

    case 'game':
      currentDestroy = renderGame(app, () => navigate('landing'))
      break
  }
}

// Boot on landing
navigate('landing')
