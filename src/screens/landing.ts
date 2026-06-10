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
    <div class="screen">
      <h1 class="screen-title">AirPair</h1>
      <p class="screen-subtitle">Deux joueurs, un seul écran partagé</p>
      <button class="btn btn-primary" id="btn-host">Héberger</button>
      <button class="btn btn-secondary" id="btn-join">Rejoindre</button>
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
