/**
 * État transitoire partagé (spec §6/§7, charte §1.5/§2.6) : un bloc centré
 * verticalement affichant une confirmation optionnelle (verte) + un loader et
 * un texte de statut, avant une navigation automatique.
 *
 * Utilisé par `host.ts` (adversaire connecté → préparation) et `join.ts`
 * (code validé → préparation). La navigation reste à la charge de l'appelant
 * (délai + callback), ce module ne fait que le rendu.
 */

/** Durée d'un état transitoire avant navigation automatique. Valeur à ajuster
 *  par test réel (spec §7, « points ouverts »). */
export const TRANSITION_DELAY_MS = 650

export interface PreparationOptions {
  /** Ligne de confirmation verte affichée au-dessus du loader (ex. "Connecté"). */
  confirm?: string
  /** Texte de statut à côté du loader. */
  status?: string
}

/** Remplace le contenu de `container` par l'état "Préparation" centré. */
export function renderPreparation(
  container: HTMLElement,
  { confirm, status = 'Préparation de la partie…' }: PreparationOptions = {}
): void {
  container.innerHTML = `
    <div class="screen screen-transition">
      <div class="transition-block">
        ${confirm ? `<p class="transition-confirm">✓ ${confirm}</p>` : ''}
        <div class="transition-status">
          <span class="spinner" aria-hidden="true"></span>
          <span>${status}</span>
        </div>
      </div>
    </div>
  `
}
