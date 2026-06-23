export interface Theme {
  id: string
  name: string
  bg: string
  lineColor: string
  paddleA: string
  paddleB: string
  ball: string
  courtLines: boolean
  stripedBg?: boolean
  tableLayout?: boolean
  tableGradient?: { from: string; to: string }
  grainTexture?: boolean
  pictogram?: 'table-tennis'
}

export const THEMES: readonly Theme[] = [
  {
    id: 'arcade',
    name: 'Arcade',
    bg: '#000',
    lineColor: 'rgba(255,255,255,0.2)',
    paddleA: '#ff2d78',
    paddleB: '#00d4e8',
    ball: '#ffe600',
    courtLines: false,
  },
  {
    id: 'synthetique',
    name: 'Synthétique',
    bg: '#1a3a6b',
    lineColor: 'rgba(255,255,255,0.4)',
    paddleA: '#fff',
    paddleB: '#fff',
    ball: '#ffe600',
    courtLines: true,
    tableLayout: true,
  },
  {
    id: 'gazon',
    name: 'Gazon',
    bg: '#2d6a2d',
    lineColor: 'rgba(255,255,255,0.5)',
    paddleA: '#fff',
    paddleB: '#fff',
    ball: '#ffe600',
    courtLines: true,
    stripedBg: true,
    tableLayout: true,
  },
  {
    id: 'terre_battue',
    name: 'Terre battue',
    bg: '#c2622d',
    lineColor: 'rgba(255,255,255,0.45)',
    paddleA: '#fff',
    paddleB: '#fff',
    ball: '#ffe600',
    courtLines: true,
    tableLayout: true,
    grainTexture: true,
  },
  {
    id: 'nostalgie_2024',
    name: 'Nostalgie 2024',
    bg: '#000',
    lineColor: 'rgba(244,195,0,0.4)',
    paddleA: '#f4c300',
    paddleB: '#f4c300',
    ball: '#fff',
    courtLines: true,
    tableGradient: { from: '#16115c', to: '#7a1050' },
    pictogram: 'table-tennis',
  },
]

const STORAGE_KEY = 'airpair_unlocked_themes'

export function getUnlockedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
    if (!ids.includes('arcade')) ids.unshift('arcade')
    return ids
  } catch {
    return ['arcade']
  }
}

export function unlockNext(): Theme | null {
  const unlocked = getUnlockedIds()
  const next = THEMES.find(t => !unlocked.includes(t.id))
  if (!next) return null
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked, next.id]))
  } catch { /* ignore */ }
  return next
}

export function getThemeById(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

// ---------------------------------------------------------------------------
// Icon renderer — draws a miniature theme preview into any canvas context.
// x/y/w/h define the bounding box within ctx (allows reuse in game overlay).
// ---------------------------------------------------------------------------

export function drawThemeIcon(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  x: number,
  y: number,
  w: number,
  h: number,
  locked: boolean
): void {
  ctx.save()

  // Clip to the icon bounding box
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  // Background
  if (!locked && theme.stripedBg) {
    ctx.fillStyle = theme.bg
    ctx.fillRect(x, y, w, h)
    const n = 6
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2d6a2d' : '#3a7a3a'
      ctx.fillRect(x, y + i * (h / n), w, Math.ceil(h / n) + 1)
    }
  } else {
    ctx.fillStyle = locked ? '#2a2a2a' : theme.bg
    ctx.fillRect(x, y, w, h)
  }

  // Court lines (non-locked themes only)
  if (!locked && theme.courtLines) {
    const M = Math.max(3, Math.round(w * 0.1))
    ctx.strokeStyle = theme.lineColor
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x + M, y);           ctx.lineTo(x + M, y + h - M)
    ctx.moveTo(x + w - M, y);       ctx.lineTo(x + w - M, y + h - M)
    ctx.moveTo(x + M, y + h - M);   ctx.lineTo(x + w - M, y + h - M)
    ctx.moveTo(x + w / 2, y);       ctx.lineTo(x + w / 2, y + h - M)
    ctx.stroke()
  }

  // Paddle
  const pW = w * 0.5
  const pH = Math.max(2, Math.round(h * 0.065))
  const pX = x + w / 2 - pW / 2
  const pY = y + h - pH - Math.round(h * 0.1)
  ctx.fillStyle = locked ? 'rgba(255,255,255,0.15)' : theme.paddleA
  ctx.fillRect(pX, pY, pW, pH)

  // Lock overlay
  if (locked) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.round(w * 0.38)}px -apple-system, sans-serif`
    ctx.fillText('🔒', x + w / 2, y + h / 2)
  }

  ctx.restore()
}
