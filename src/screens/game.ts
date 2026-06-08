/**
 * Placeholder game screen — the actual game logic will be implemented in a
 * future PR.
 */
export function renderGame(container: HTMLElement, onBack: () => void): () => void {
  container.innerHTML = `
    <div class="screen">
      <button class="btn-back" id="btn-back">← Retour</button>
      <h2 class="screen-title">Jeu à venir…</h2>
    </div>
  `

  const btnBack = container.querySelector<HTMLButtonElement>('#btn-back')
  const handleBack = (): void => onBack()
  btnBack?.addEventListener('click', handleBack)

  return () => {
    btnBack?.removeEventListener('click', handleBack)
    container.innerHTML = ''
  }
}
