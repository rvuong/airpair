/**
 * Écran de fin de partie (spec §5) — module DOM distinct rendu en overlay
 * au-dessus du canvas de jeu (le client WS et la boucle restent vivants pour
 * permettre la revanche in-game).
 *
 * 5 états : Victoire + déblocage / Victoire simple / Défaite (neutre) /
 * Revanche envoyée / Revanche reçue. La mécanique de revanche est une poignée
 * de main symétrique (`rematch_ready`, cf. charte §1.6) pilotée par `game.ts` :
 * ce module ne fait que le rendu et expose des transitions d'état.
 */

export interface EndParams {
  won: boolean
  myScore: number
  opponentScore: number
  /** Nom du thème débloqué par cette victoire, ou null. */
  unlockedThemeName: string | null
}

export interface EndCallbacks {
  /** Le joueur local clique REVANCHE (idle) ou ACCEPTER (revanche reçue). */
  onRematch: () => void
  /** NOUVELLE PARTIE → retour à l'accueil (jamais « retour » technique). */
  onNewGame: () => void
}

export interface EndController {
  /** Le local a demandé la revanche, l'adversaire n'a pas encore répondu. */
  showRematchSent: () => void
  /** L'adversaire a demandé la revanche en premier. */
  showRematchReceived: () => void
  destroy: () => void
}

const NEW_GAME_BLOCK = `
  <div class="cta-block">
    <button class="btn btn-outline" id="btn-newgame">NOUVELLE PARTIE</button>
    <p class="cta-caption">Avec un autre joueur</p>
  </div>
`

export function renderEnd(
  container: HTMLElement,
  params: EndParams,
  cb: EndCallbacks
): EndController {
  const overlay = document.createElement('div')
  overlay.className = 'end-overlay'

  const titleClass = params.won ? 'win' : 'lose' // DÉFAITE reste neutre (charte §1.7)
  const unlockLine =
    params.won && params.unlockedThemeName
      ? `<p class="end-unlock">Vous avez débloqué le thème ${params.unlockedThemeName}</p>`
      : ''

  overlay.innerHTML = `
    <div class="end-header">
      <h1 class="end-title ${titleClass}">${params.won ? 'VICTOIRE' : 'DÉFAITE'}</h1>
      ${unlockLine}
      <p class="end-score">${params.myScore} – ${params.opponentScore}</p>
    </div>
    <div class="end-actions" id="end-actions"></div>
  `
  container.appendChild(overlay)

  const actions = overlay.querySelector<HTMLElement>('#end-actions')!

  const wireNewGame = (): void => {
    actions.querySelector<HTMLButtonElement>('#btn-newgame')
      ?.addEventListener('click', cb.onNewGame)
  }
  const wireRematch = (): void => {
    actions.querySelector<HTMLButtonElement>('#btn-rematch')
      ?.addEventListener('click', cb.onRematch)
  }

  function renderIdle(): void {
    actions.innerHTML = `
      <div class="cta-block">
        <button class="btn btn-action" id="btn-rematch">REVANCHE</button>
        <p class="cta-caption">Même partie, on recommence</p>
      </div>
      ${NEW_GAME_BLOCK}
    `
    wireRematch()
    wireNewGame()
  }

  function renderSent(): void {
    // La revanche est partie : plus de fond coloré, juste un statut.
    // NOUVELLE PARTIE reste cliquable pour annuler (spec §5).
    actions.innerHTML = `
      <p class="end-status">En attente de ton adversaire…</p>
      ${NEW_GAME_BLOCK}
    `
    wireNewGame()
  }

  function renderReceived(): void {
    // Jamais « le joueur A/B » (charte §1.1). ACCEPTER = même action, même
    // couleur que REVANCHE.
    actions.innerHTML = `
      <p class="end-received">Ton adversaire souhaite une revanche</p>
      <div class="cta-block">
        <button class="btn btn-action" id="btn-rematch">ACCEPTER</button>
      </div>
      ${NEW_GAME_BLOCK}
    `
    wireRematch()
    wireNewGame()
  }

  renderIdle()

  return {
    showRematchSent: renderSent,
    showRematchReceived: renderReceived,
    destroy: () => overlay.remove(),
  }
}
