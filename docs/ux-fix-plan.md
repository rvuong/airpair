# Plan de correction UX — écrans hors-jeu

Document de pilotage pour corriger les écarts entre `docs/ux-charte-principes.md`
+ `docs/ux-redesign-spec.md` et l'implémentation actuelle de `src/screens/`.
**Aucune implémentation à ce stade** — ce fichier liste le travail à faire,
dans l'ordre, avec les décisions déjà tranchées et celles qui restent ouvertes.

Sources : [ux-charte-principes.md](./ux-charte-principes.md) (règles
transversales), [ux-redesign-spec.md](./ux-redesign-spec.md) (détail par
écran).

**Backend (`server/server.ts`) : aucune évolution nécessaire.** Le serveur
est un relais générique (~100 lignes) qui ne connaît que 5 types de message
(`create`, `join`, `relay`, `server_ping`, `start_countdown`) et n'inspecte
jamais le contenu du `payload` relayé — toute la logique de jeu (`hit`,
`miss`, `player_ready`, futur `rematch_ready`) vit côté client dans `GameMsg`
(`src/net/ws.ts`). Ça reste vrai même pour le chantier le plus "réseau" de ce
plan (poignée de main symétrique de revanche, §6) et pour le déplacement du
countdown (§5) : les deux s'appuient sur des primitives serveur déjà
génériques (`relay` agnostique du contenu, `start_countdown`/`countdown`
utilisable depuis n'importe quel point du parcours côté hôte).

---

## 0. Décisions actées pour ce plan (arbitrages de session)

| Sujet | Décision | Raison |
|---|---|---|
| Architecture `end.ts` | **Migrer vers un vrai module DOM** `src/screens/end.ts`, distinct du canvas de jeu | Aligné avec la spec (écran hors-jeu au même titre que `landing`/`host`/`join`) ; seule option qui permette de factoriser `TransitionStatus`/`ReadyHandshake` avec les autres écrans |
| Nom de fichier hôte | **Garder `host.ts`** (ne pas renommer en `create.ts`) | Nom déjà établi dans `docs/decisions.md` (D22) et l'historique de commits ; le renommer casserait la continuité documentaire sans bénéfice fonctionnel. La spec de refonte utilise "create.ts" comme nom descriptif, pas comme exigence de fichier. |
| Clic thème verrouillé | **Rester silencieux, aucun clic possible** (pas de nouveau handler) | Cohérent avec D22 déjà acté ("non cliquables") — ne pas rouvrir cette décision |
| Position du countdown 3-2-1 | **Déplacer de la connexion (`host.ts`/`join.ts`) vers la convergence `player_ready` dans `game.ts`** | La spec (§4, État 3/3b/3c) place le countdown après le choix tilt/toucher, pas avant l'entrée dans `game.ts`. Le mécanisme serveur `start_countdown`/`countdown` (+3500ms, gate rôle A) est un relais générique déjà réutilisable tel quel — voir §3/§4/§5 et l'analyse backend ci-dessous |
| `accent-green-success` | **`#39ff14`** | Valeur finalisée dans [ux-charte-principes.md](./ux-charte-principes.md#31--couleurs) §3.1 — remplace la valeur de travail `#00e676` envisagée initialement dans ce plan |

---

## 1. Design tokens (base de tout le reste)

Fichier : `src/index.html` (bloc `<style>`), à transformer en variables CSS sur `:root`.

```css
html {
  /* base ~16px @ 390px de large, bornée pour rester lisible sur petit/grand
     écran — cf. charte §2.8. Tous les text-* ci-dessous sont en rem, donc
     s'échelonnent automatiquement avec cette racine. */
  font-size: clamp(14px, 4.1vw, 19px);
}

:root {
  --bg-primary: #080818;
  --accent-role-a: #ff2d78;
  --accent-role-b: #00d4e8;
  --accent-yellow-action: #ffe44d;
  --accent-green-success: #39ff14; /* contraste à vérifier, voir "points encore ouverts" */
  --text-secondary: /* à définir, voir §6 */;

  /* Tailles typographiques — cf. charte §3.3, valeurs rem = indicatif px / 16 */
  --font-size-display: 2.25rem;        /* 36px @ 390px */
  --font-size-cta: 1rem;               /* 16px @ 390px */
  --font-size-body: 1.125rem;          /* 18px @ 390px */
  --font-size-secondary: 0.875rem;     /* 14px @ 390px */
  --font-size-status-success: 0.875rem;/* 14px @ 390px */
  --font-size-link: 0.875rem;          /* 14px @ 390px */

  --radius-btn: 12px;
  --radius-panel-bottom: 8px;
  --frame-margin: 24px;
  --frame-content-width: 342px;
}
```

Corrections à appliquer en même temps :
- `body { background: #111 }` → `var(--bg-primary)` (actuellement incohérent avec le `<meta name="theme-color" content="#080818">` déjà présent)
- `.btn`, `.input-text`, `.tab-bar`, `.video-container` : `max-width: 320px` → `342px` exactement (`index.html:73,126,216,227`) — c'est le piège "320px halluciné" documenté en §2.7 de la charte, jamais corrigé dans le code
- Uniformiser les rayons : boutons 12px (déjà correct sur `.btn` et sur les boutons canvas `roundedRectPath`), 8px uniquement sur les coins bas des panneaux accolés (sélecteur de thème une fois converti en dropdown ancré, §3)
- Retirer l'emoji `🔒` en dur dans `src/game/themes.ts:169` (icône canvas custom à dessiner, pas de dépendance à un glyphe emoji en prod — cf. charte §2.5)
- **Remplacer toutes les tailles en `px`/`rem` codées en dur par les tokens `--font-size-*`** : `index.html` (`.screen-title: 2rem`, `.screen-subtitle: 2rem`, `.status-msg: 1.875rem`, `.room-code: 2.5rem`, `.btn-tab: 1.875rem`, `.btn-back: 1.875rem`…) et les styles inline de `game.ts` (`pre-overlay` en `30px`/`20px`). Aucune de ces valeurs actuelles ne correspond à un token de la charte — chacune doit être remappée sur le style le plus proche (`text-display`/`text-body`/`text-secondary`/…) plutôt que gardée comme valeur ad hoc

Un composant `Button` (variantes `role-a` / `role-b` / `action` / `outline`) est recommandé par la spec (§6) mais peut rester une fonction utilitaire simple (pas de framework UI, cf. `CLAUDE.md`) — à trancher au moment de l'implémentation, pas bloquant pour ce plan.

---

## 2. `landing.ts`

- Libellés : `NOUVELLE PARTIE` (sous-texte `Tu invites un ami`) / `REJOINDRE UNE PARTIE` (sous-texte `Un ami t'invite à le rejoindre`)
- Unifier `.btn-primary`/`.btn-secondary` en un seul style **outline neutre** partagé pour les deux CTA (actuellement un plein gris clair vs un plein gris foncé bordé — deux styles différents, contraire à "visuellement identiques")
- Aucune couleur de rôle sur cet écran (déjà le cas, à préserver)

---

## 3. `host.ts`

Ordre d'implémentation à respecter : cet écran touche à la logique réseau (suppression du bouton de lancement), donc à traiter avec la même rigueur que `game.ts` (voir §7).

- **Supprimer le bouton "Lancer ▶"** (`host.ts:215-230`) et son handler `client.startCountdown()` sur clic — c'est le point le plus sensible du plan : reproduit sinon le bug D03 déjà documenté (bouton de démarrage manuel côté hôte)
- **Retirer le câblage `client.onCountdown` actuel** (`host.ts:221-224`), qui affiche aujourd'hui le countdown 3-2-1 à ce stade (avant même d'entrer dans `game.ts`). Ce n'est plus le bon emplacement : la spec (§4) place ce countdown après le choix tilt/toucher, pas à la connexion — voir §5. `host.ts` ne doit plus jamais appeler `startCountdown()` ni écouter `countdown`
- Implémenter la séquence de transition automatique B connecté → Préparation → `game.ts`, via le composant `TransitionStatus` (§7) : `✓ Le joueur B a rejoint la partie` (vert) → `⟳ Préparation de la partie…` → navigation **directe** vers `game.ts` (appel de `onReady()`, sans countdown à ce stade)
- Garde-fou : si le sélecteur de thème est ouvert quand B se connecte, attendre sa fermeture avant de lancer la transition automatique
- Retirer toute mention "joueur B" à l'écran : `"En attente du joueur B…"` (`host.ts:63`) → `"En attente de ton adversaire…"` ; `"Joueur B connecté ✓"` (`host.ts:193`) → texte neutre équivalent, avant remplacement par `TransitionStatus`
- Fusionner QR + code : code = légende du QR, collée sans espace, couleur `accent-role-A`, taille réduite (~20-22px — voir §6, point encore ouvert sur le token `text-code`)
- Remplacer le sélecteur de thème pleine largeur (`host.ts:80-134`) par une icône discrète en coin haut-droit (symétrique du bouton retour), overlay ancré avec ombre portée (charte §3.6) au clic, coins bas arrondis à 8px
- Présélection du thème = **dernier thème utilisé** : ajouter la persistance du dernier thème choisi dans `localStorage` (nouvelle clé, à ajouter dans `src/game/themes.ts` à côté de `airpair_unlocked_themes`), plutôt que le `selectedThemeId = 'arcade'` actuel (`host.ts:31`)
- Thèmes verrouillés : aucun changement de comportement (décision §0) — garder l'absence de handler de clic

---

## 4. `join.ts`

- Remplacer la structure à onglets égaux (`Scanner` / `Code`) par le pattern CTA dominant + fallback :
  - `[ 📷 SCANNER LE QR-CODE ]` plein, couleur `accent-role-B`, 342px
  - séparateur `── ou ──`
  - `Entrer le code` en input outline, même largeur
- État scan : garder le flux caméra + viewfinder, ajouter le fallback "Saisir le code à la place" toujours visible pendant le scan
- État Préparation : centrer verticalement le contenu (charte §2.6) au lieu de le laisser ancré en haut — même traitement que l'état "Préparation" de `host.ts`, via `TransitionStatus`
- **Retirer le câblage `client.onCountdown` actuel** (`join.ts:185-188`), symétrique du point équivalent sur `host.ts` (§3) — B ne doit plus voir de countdown 3-2-1 à ce stade non plus. La transition mène directement à `game.ts` via `onReady()`
- Permission caméra : déjà correctement isolée au clic sur le CTA scanner (`join.ts:227-260`, `getUserMedia` dans le handler du bouton) — aucun changement requis sur ce point, juste vérifier qu'il n'y a pas de régression lors de la refonte visuelle

---

## 5. `game.ts` (le sas — traiter avec prudence, historique D03)

- Recolorer le bouton `Je suis prêt` (`game.ts:150-155`, actuellement `#f5f5f5`/`#111`) en `accent-yellow-action` (`#ffe44d`), texte sombre pour le contraste
- Remplacer les tailles en dur du `pre-overlay` (`game.ts:140-171`, `30px`/`20px` inline) par les tokens `--font-size-*` (§1) — cet overlay est du DOM classique, pas du canvas, donc concerné par la règle de tailles relatives §2.8 de la charte
- Séparer l'état "Prêt" en deux lignes distinctes au lieu du texte fusionné actuel (`game.ts:1047`, `"Prêt — inclinez pour jouer ✓"`) :
  - ligne principale : `✓ Prêt` (vert `accent-green-success`, gras)
  - ligne secondaire : `Tilt activé` / `Contrôle : toucher` (`text-secondary`)
- **Retirer la nomenclature A/B affichée** : `game.ts:1029`, `` `Le joueur ${otherRole} se prépare…` `` → `` `Ton adversaire se prépare…` `` (variable `otherRole` reste utilisée en interne pour la logique, seulement le texte affiché change)
- **Ajouter le countdown 3-2-1 manquant après la convergence `player_ready`** (États 3/3b/3c de la spec §4, actuellement absents de cet écran — voir §0 et l'analyse backend en tête de ce document) :
  - `tryActivate()` (`game.ts:402-404`) ne doit plus appeler `activateGame()` directement quand `localReady && peerReady`. À la place : si `role === 'A'`, appeler `client.startCountdown()` ; les deux joueurs attendent ensuite le message `countdown` relayé par le serveur
  - Rebrancher `client.onCountdown` **dans `game.ts`** (déplacé depuis `host.ts`/`join.ts`, voir §3/§4) : à la réception, afficher `renderCountdown()` (déjà conforme, réutilisable tel quel — `countdown.ts`) directement sur le sas, puis appeler `activateGame()` à la fin, comme le fait aujourd'hui `onReady()` côté connexion
  - Aucune modification du serveur requise : `start_countdown`/`countdown` (+3500ms, gate rôle A) est le même mécanisme, seul le point d'appel côté client change de place
- Countdown (`countdown.ts`) : ✅ le composant lui-même déjà conforme (chiffre seul, rien d'autre) — seul son point de déclenchement change (voir point ci-dessus)
- Ne toucher à **aucune** logique de `player_ready` en dehors de ce changement de séquencement — le fonctionnement du handshake (`localReady`/`peerReady`) reste identique, c'est uniquement ce qu'il déclenche qui change ; ce socle est celui sur lequel `end.ts` doit s'aligner pour `rematch_ready` (voir §7)

---

## 6. `end.ts` (nouveau module DOM — n'existe pas encore)

Chantier le plus large du plan, conforme à la décision §0 (migration DOM).

- Créer `src/screens/end.ts`, extrait de la logique canvas actuelle de la phase `game_over` dans `game.ts` (`game.ts:860-1007` pour le rendu, `game.ts:975-1006` pour la détection de tap sur les boutons)
- Les tailles actuelles sont calculées en proportion de la largeur du canvas (`W * 0.09`, `W * 0.06`…) — une fois migrées en DOM, elles doivent être réexprimées avec les tokens `--font-size-*` (§1), pas recopiées en `vw`/`px` ad hoc
- 5 états à implémenter : Victoire + déblocage / Victoire simple / Défaite (neutre, déjà correct visuellement) / Revanche envoyée / Revanche reçue
- `VICTOIRE` en `accent-green-success`, `DÉFAITE` reste blanc/neutre (aucun changement sur ce point, déjà conforme à la charte §1.7)
- **Implémenter la poignée de main symétrique pour la revanche**, par analogie directe avec `player_ready` :
  - chaque joueur envoie son propre `rematch_ready` au clic (`REVANCHE` ou `ACCEPTER` selon qui a cliqué en premier)
  - redémarrage vers `game.ts` seulement quand les deux signaux sont reçus
  - **remplacer le comportement actuel** (`game.ts:997-1001`, clic "Revanche" → `resetGame()` immédiat en local, sans attendre l'adversaire) qui reproduit exactement le bug D03 déjà corrigé une fois sur le sas
  - pas de vrai système demande/accepte côté serveur : même message `rematch_ready`, libellé différent côté client selon qui a cliqué en premier
- Bouton `REVANCHE`/`ACCEPTER` en `accent-yellow-action` (actuellement blanc, `game.ts:906-912`)
- Remplacer `Retour` par `NOUVELLE PARTIE` + sous-texte `Avec un autre joueur` (`game.ts:914-921`) — navigue vers `landing.ts`, jamais "retour à l'accueil"
- État "Revanche envoyée" : le bouton REVANCHE est remplacé par un statut `En attente de ton adversaire…` (pas de fond coloré), `NOUVELLE PARTIE` reste cliquable pour annuler
- État "Revanche reçue" : texte `Ton adversaire souhaite une revanche` (jamais "Le joueur A/B souhaite…") au-dessus du bouton `ACCEPTER`

---

## 7. Factorisation transverse

À extraire une fois les écrans 2 à 6 corrigés, pas avant (éviter de factoriser une logique pas encore stabilisée) :

- **`TransitionStatus`** : texte de statut (couleur variable) + loader + délai configurable + callback de navigation. Utilisé par `host.ts` (B connecté → Préparation), `join.ts` (Code validé → Préparation), potentiellement `end.ts` (double `rematch_ready` → countdown)
  - délai : constante nommée `TRANSITION_DELAY_MS` (600-800ms, valeur exacte non bloquante — à ajuster par test réel, cf. spec §7)
- **`ReadyHandshake`** (logique, pas juste visuel) : fonction générique gérant `localReady`/`peerReady` + déclenchement conditionnel quand les deux signaux sont reçus. Remplace la duplication actuelle entre `player_ready` (`game.ts`) et le futur `rematch_ready` (`end.ts`)

---

## Points encore ouverts (à trancher avant ou pendant l'implémentation, non bloquants pour ce plan)

- **Valeur exacte de `text-secondary`** (gris moyen) — aucun hex retenu, doit être vérifié ≥4,5:1 de contraste sur `#080818` avant merge (D21)
- **Contraste des combos texte-sur-bouton colorés** (noir sur `accent-role-A`/`accent-role-B`/`accent-yellow-action`/`accent-green-success` `#39ff14`) — à vérifier avec un outil WCAG avant merge final
- **Token `text-code`** pour le code de room réduit (~20-22px) — la spec laisse ouvert "style dédié `text-code` ou variante de `text-display`" ; à trancher au moment d'écrire le CSS, sans impact sur le reste du plan
- **Durée exacte des états transitoires** (600-800ms) — non bloquant, implémenter avec `TRANSITION_DELAY_MS` ajustable

---

## Ordre d'implémentation suggéré

1. Design tokens (§1) — base de tout le reste
2. `landing.ts` (§2) — le plus simple, valide la structure de base
3. `host.ts` + `join.ts` (§3-4) — en parallèle si possible
4. `game.ts` (§5) — changements de texte/couleur uniquement, ne pas toucher à la logique `player_ready`
5. `end.ts` (§6) — le plus sensible : nouvelle mécanique réseau (`rematch_ready`), à tester aussi soigneusement que `game.ts` contre une régression du bug D03
6. Factorisation `TransitionStatus`/`ReadyHandshake` (§7) — une fois les écrans stabilisés
