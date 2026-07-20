export type LandingChoice = 'host' | 'join'

/**
 * Renders the landing screen into `container`.
 * Calls `onChoice` when the user taps a button.
 * Returns a `destroy` function for cleanup.
 */
export function renderLanding(
  container: HTMLElement,
  onChoice: (choice: LandingChoice) => void
): () => void {
  container.innerHTML = `
    <div class="screen screen-landing">
      <div class="landing-header">
      <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" role="img" aria-label="AirPair">
        <title>AirPair</title>
        <rect width="80" height="80" rx="17.6" fill="#080818"/>
        <rect x="17.6" y="16" width="44.8" height="9.6" rx="4.8" fill="#00d4e8"/>
        <line x1="40" y1="25.6" x2="40" y2="33.6" stroke="#ffe44d" stroke-width="1.6" stroke-dasharray="1.6,2.4" stroke-linecap="round" opacity="0.5"/>
        <circle cx="40" cy="40" r="6.4" fill="#ffe44d"/>
        <line x1="40" y1="46.4" x2="40" y2="54.4" stroke="#ffe44d" stroke-width="1.6" stroke-dasharray="1.6,2.4" stroke-linecap="round" opacity="0.5"/>
        <rect x="17.6" y="54.4" width="44.8" height="9.6" rx="4.8" fill="#ff2d78"/>
        <text x="96" y="54" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="38" font-weight="800" letter-spacing="-1"><tspan fill="#00d4e8">Air</tspan><tspan fill="#ff2d78">Pair</tspan></text>
        <g transform="translate(275, 12) rotate(25)">
          <rect x="-22" y="-9" width="44" height="18" rx="3" fill="#ffe44d"/>
          <text x="0" y="0" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="11" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="central">beta</text>
        </g>
      </svg>
      </div>
      <div class="landing-body">
        <p class="landing-tagline">2 joueurs<br>2 terrains<br>1 seule balle</p>
        <div class="landing-cta-center">
          <div class="landing-cta">
            <div class="cta-block">
              <button class="btn btn-outline" id="btn-host">NOUVELLE PARTIE</button>
              <p class="cta-caption">Tu invites un ami</p>
            </div>
            <div class="cta-block">
              <button class="btn btn-outline" id="btn-join">REJOINDRE UNE PARTIE</button>
              <p class="cta-caption">Un ami t'invite à le rejoindre</p>
            </div>
          </div>
        </div>
      </div>
      <div class="landing-footer" aria-hidden="true"></div>
    </div>
  `

  const btnHost = container.querySelector<HTMLButtonElement>('#btn-host')
  const btnJoin = container.querySelector<HTMLButtonElement>('#btn-join')

  const handleHost = (): void => onChoice('host')
  const handleJoin = (): void => onChoice('join')

  btnHost?.addEventListener('click', handleHost)
  btnJoin?.addEventListener('click', handleJoin)

  return () => {
    btnHost?.removeEventListener('click', handleHost)
    btnJoin?.removeEventListener('click', handleJoin)
    container.innerHTML = ''
  }
}
