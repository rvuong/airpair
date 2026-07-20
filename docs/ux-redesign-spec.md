# AirPair — Spec de refonte UX (écrans hors-jeu)

Document de travail issu d'une session de wireframing Figma. Destiné à piloter
l'implémentation dans `src/screens/`. Chaque section référence les décisions
`decisions.md` concernées (D03, D05, D06, D19, D22...) pour ne pas dupliquer
le POURQUOI — ce document se concentre sur le QUOI et le COMMENT visuel.

**Portée : écrans hors-jeu uniquement.** Landing, création/join de partie,
sas de préparation, fin de partie. Le Canvas de jeu lui-même (thèmes D22,
HUD, effets D25) n'est pas concerné.

---

## 0. Design tokens

### Couleurs

| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#080818` | Fond principal, tous écrans |
| `accent-role-A` | `#ff2d78` | Actions/éléments liés au rôle A (hôte) — **anciennement nommé accent-cyan-A, corrigé pour cohérence avec le Canvas (D22/Q13)** |
| `accent-role-B` | `#00d4e8` | Actions/éléments liés au rôle B (joueur qui rejoint) — **anciennement accent-magenta-B, corrigé** |
| `accent-yellow-action` | `#ffe44d` | Action neutre, ni A ni B (bouton "Je suis prêt", countdown, revanche) — cohérent avec balle/indicateur d'approche en jeu (D22) |
| `accent-green-success` | à définir (`#00e676` ou `#39ff14` suggérés) | Confirmation/succès uniquement — n'existe pas dans le jeu actuel, ajout pur UI |
| `text-secondary` | gris moyen, à vérifier ≥4,5:1 sur `bg-primary` (D21) | Texte discret, statuts neutres |

⚠️ **Vérification requise avant merge** : contraste des combos texte-sur-bouton
(noir sur `accent-role-A`/`accent-role-B`, `text-secondary` sur `bg-primary`)
avec un outil WCAG — pas encore vérifié pendant le wireframe (D21 l'exige).

**Principe de couleur (tranché en session) :** pas de convention universelle
(rouge=erreur, bleu=action) — la palette encode des **rôles**, pas des
fonctions sémantiques génériques. La couleur de rôle n'apparaît qu'une fois
le rôle réellement attribué (voir §1, Landing reste neutre).

### Typographie — Text styles

| Style | Taille | Graisse | Line-height | Usage |
|---|---|---|---|---|
| `text-display` | 32-36px | Bold/Black | 140% | Code de partie (A7K3B2) — **réduit à ~20-22px une fois fusionné avec le QR (§2)**, à trancher : style dédié `text-code` ou variante |
| `text-cta` | 16px | Bold | 140% | Libellé de bouton d'action |
| `text-body` | 16-18px | Regular | 140% | Instruction, contenu principal |
| `text-secondary` | 13-14px | Regular | 130% | Sous-texte, statut neutre, tagline |
| `text-status-success` | 14-16px | Bold | 140% | Confirmation positive (vert) |
| `text-link` | 14px | Regular, souligné | 140% | Élément cliquable secondaire (fallback) |

### Grille

- Frame de référence : 390×844 (iPhone 14/15 Pro)
- Marges latérales fixes : **24px** de chaque côté → largeur utile **342px**
- Tout élément pleine largeur (boutons, inputs) doit faire exactement 342px,
  jamais une valeur approximative (piège rencontré en session : 320px halluciné
  au début, corrigé partout ensuite)
- Touch targets ≥ 44×44px (D21, déjà une règle actée projet)

---

## 1. `landing.ts`

### Contenu
- Logo SVG (`src/assets/logo.svg` existant, D24) + wordmark
- Tagline 3 lignes, centrée : `2 joueurs` / `2 terrains` / `1 seule balle`
  (sans virgules — choix délibéré, le saut de ligne porte déjà la pause)
- 2 CTA **visuellement identiques** (style outline, neutre — voir décision
  couleur ci-dessous), différenciés uniquement par le libellé :
  - `NOUVELLE PARTIE` + sous-texte `Tu invites un ami`
  - `REJOINDRE UNE PARTIE` + sous-texte `Un ami t'invite à le rejoindre`

### Décision de couleur (tranchée en session)
**Les 2 boutons restent neutres** (style outline blanc/gris, pas de couleur
de rôle). Raison : à ce stade du parcours, aucun rôle A/B n'est encore
attribué — colorer un bouton en `accent-role-A` avant que l'utilisateur ait
cliqué dessus fait une promesse de sens que l'interface ne tient pas encore.
La couleur de rôle n'apparaît qu'à partir de `create.ts`/`join.ts`, une fois
le rôle réellement acquis.

### Ce qui a changé par rapport à l'existant
- Libellés `CRÉER UNE PARTIE`/`REJOINDRE` jugés ambigus (ne disent pas quoi on
  crée/rejoint) → renommés + sous-textes ajoutés
- Si l'implémentation actuelle a des couleurs différentes par bouton →
  uniformiser en neutre

---

## 2. `create.ts` (écran hôte, rôle A)

### États à implémenter
1. **Attente B** — code + QR affichés, thème modifiable
2. **B connecté** — transitoire, ~600-800ms (durée à valider par test réel)
3. **Préparation** — loader + `Préparation de la partie…`, avant transition
   vers `game.ts`
4. **Sélecteur de thème ouvert** — overlay ancré à une icône, pas un écran
   séparé

### Structure visuelle (état 1 — Attente B)

```
← Accueil                                    🎨
     
   [ QR code 140×140, fond blanc ]
        A7K3B2                    ← légende collée au QR, pas d'espace
                                     couleur accent-role-A, taille réduite
                                     (~20-22px, pas 32-36px — ce n'est plus
                                     l'élément dominant de l'écran)

   En attente du joueur B…
```

**Fusion QR+code (décision de session) :** le QR et le code ne sont plus
2 éléments séparés en concurrence visuelle — ils forment un seul artefact
(code = légende du QR, collé, sans espace). Optionnel : cadre englobant
discret (stroke 8-10% opacité) pour renforcer l'unité visuelle.

**Icône thème (décision de session) :** remplace l'ancien bouton
"Terrain: Arcade ▾" pleine largeur. Devient une icône discrète (`🎨` ou
équivalent redessiné en prod, cf. §5) en coin haut-droit, symétrique du
bouton retour. Raison : le thème est une option secondaire, pas un choix
central du parcours — son poids visuel doit refléter ça.

### Comportement de sélection du thème (à valider — D22 amendé en session)

**Décision actée en session, à répercuter dans le code :** le thème
pré-sélectionné par défaut n'est plus systématiquement "Arcade" — c'est
**le dernier thème utilisé par ce joueur** (déjà en `localStorage` selon
D22, à réutiliser comme valeur par défaut du sélecteur plutôt que de
réinitialiser à Arcade à chaque partie). Possibilité de changer reste
disponible, la plus simple et discrète possible, avant le début du match —
via l'icône en coin, pas un menu imposant.

### Transition B connecté → Préparation → game.ts
Séquence à implémenter, pas de bouton "Démarrer" (D03, itération 2
définitivement abandonnée — voir rappel critique ci-dessous) :

```
✓ Le joueur B a rejoint la partie   (vert, ~600-800ms)
   ↓
⟳ Préparation de la partie…         (bref, transitoire)
   ↓
navigation automatique vers game.ts
```

⚠️ **Point non tranché, à trancher en dev ou par test réel :** durée exacte
de chaque étape transitoire. Ne pas bloquer l'implémentation dessus — mettre
une valeur raisonnable (600-800ms total) et l'exposer comme constante
facilement modifiable (`TRANSITION_DELAY_MS` ou similaire, dans l'esprit des
constantes déjà nommées ailleurs dans le projet, ex. `APPROACH_GAP_MS`).

**Garde-fou obligatoire :** si le sélecteur de thème est ouvert au moment où
B se connecte, la transition automatique doit attendre sa fermeture — ne
jamais arracher l'utilisateur d'un choix en cours.

### 🚨 Rappel critique — ne pas réintroduire un bug déjà résolu (D03)
Le fichier `decisions.md` documente en détail un bug déjà corrigé une fois :
un bouton "Démarrer" côté A créait une fenêtre de course où B n'avait pas le
temps de répondre à sa propre permission tilt. **Ne pas recréer de bouton de
démarrage manuel côté A** dans cette refonte — la transition doit rester
automatique, déclenchée par la connexion WebSocket de B, jamais par un clic
de A.

---

## 3. `join.ts` (écran B)

### États à implémenter
1. **Rejoindre** — CTA scanner (dominant) + fallback code (discret)
2. **Scan en cours** — flux caméra + viewfinder + fallback toujours visible
3. **Préparation** — miroir exact de l'état "Préparation" côté A (même texte,
   même loader — c'est le même événement vu des deux côtés)

### Structure visuelle (état 1)

```
← Accueil

[ 📷 SCANNER LE QR-CODE ]     ← CTA plein, couleur accent-role-B, 342px

────────── ou ──────────

[ Entrer le code            ]  ← input outline, 342px, même hauteur que CTA
```

### État 2 — Scan
```
[ flux caméra plein cadre ]
     [ viewfinder 200×200, stroke blanc ]
        Visez le code de A

  Saisir le code à la place    ← fallback toujours accessible, même
                                   pendant le scan (permission caméra
                                   demandée ici, jamais ailleurs — voir
                                   note découplage ci-dessous)
```

### État 3 — Préparation (centrage vertical, pas juste "vide")
Le bloc de confirmation doit être **centré verticalement** dans tout
l'espace disponible du frame, pas juste ancré en haut — sinon l'écran se lit
comme "incomplet" plutôt que "état de pause intentionnel, bref".

```
        ✓ Connecté
   ⟳ Préparation de la partie…
```

### Rappel architecture permissions (D03, itération 2 abandonnée — critique)
La permission **caméra** (`getUserMedia()`) se déclenche **uniquement** au
clic sur "SCANNER LE QR-CODE", sur cet écran. La permission **tilt**
(`requestPermission()`) se déclenche **uniquement** sur `game.ts`, au clic
individuel de chaque joueur sur "Je suis prêt". **Ne jamais coupler les deux
demandes sur un même clic** — ça produit un empilement de 2 popups natives
consécutives, déjà testé et confirmé confus par un vrai utilisateur.

---

## 4. `game.ts` — le sas (écran identique A/B, aucune branche par rôle)

C'est l'écran le plus documenté et le plus itéré du projet (D03, 3
correctifs UI + 2 fixes de bug déjà en prod). **Toute modification ici doit
être validée contre l'historique complet de D03 avant merge** — les pièges
qu'il documente ont déjà coûté plusieurs itérations réelles.

### États à implémenter

**État 1 — Choix initial**
```
7 pts · marge 2                          ← version courte, PAS "7 points
                                              · marge : 2" (bug de wrap déjà
                                              rencontré sur Pixel 7, D13)

Inclinez votre téléphone pour
contrôler la raquette

[ Je suis prêt ]                          ← accent-yellow-action, 342px
                                              déclenche requestPermission()
                                              POUR SOI-MÊME uniquement

Si vous préférez jouer au
toucher, cliquez ici                      ← force le mode toucher, ne
                                              déclenche AUCUNE permission
```

**État 2 / 2b — Prêt, attente adversaire** (variante tilt et variante
toucher, structure identique)
```
7 pts · marge 2

✓ Prêt                                    ← statut PRINCIPAL, vert, gras
                                              (inversé en session : priorité
                                              au fait "je suis prêt" sur la
                                              méthode choisie)

Tilt activé  /  Contrôle : toucher        ← confirmation secondaire,
                                              text-secondary, sous le statut

Ton adversaire se prépare…                ← n'apparaît que si l'autre n'a
                                              pas encore choisi
```

⚠️ **Jamais nommer "Le joueur A" / "Le joueur B" à l'écran** — corrigé en
session par rapport au texte source de D03 qui utilisait ce libellé. Le
produit ne doit jamais exposer la nomenclature interne A/B au joueur, nulle
part dans le parcours (cohérence avec `end.ts`, "ton adversaire").

**État 3 / 3b / 3c — Countdown (3, 2, 1)**
Frame quasi vide, chiffre seul, énorme (120-140px), centré horizontal ET
vertical. Aucun texte d'accompagnement — l'utilisateur sait déjà ce qui
arrive, ne rien expliquer à ce stade précis.

### Logique de poignée de main à respecter (D03, `player_ready`)
- Chaque joueur envoie `player_ready` **dès qu'il a choisi** (tilt ou
  toucher), indépendamment de l'autre
- `activateGame()` / transition vers countdown seulement quand
  `localReady && peerReady`
- **Aucune branche par rôle** — le composant/écran doit être strictement
  identique, piloté par l'état local (`ready`/`not ready`), jamais par
  `role === 'A'`
- Filet de sécurité déjà en prod à ne pas régresser : bascule silencieuse en
  toucher après `TILT_FALLBACK_TIMEOUT_MS` (1300ms) si aucun
  `deviceorientation` réel n'est reçu

---

## 5. `end.ts`

### États à implémenter (5 au total)

1. **Victoire + déblocage** — `VICTOIRE` (vert) + `Vous avez débloqué le
   thème [Nom]` + les 2 CTA
2. **Victoire simple** — identique sans la ligne de déblocage
3. **Défaite** — `DÉFAITE`, couleur **neutre** (blanc, pas rouge — perdre
   fait partie du jeu, pas une erreur système à signaler comme telle)
4. **Revanche envoyée** — celui qui a cliqué "Revanche" en premier
5. **Revanche reçue** — celui qui répond

### CTA de base
```
[ REVANCHE ]              accent-yellow-action, 342px
Même partie, on recommence

[ NOUVELLE PARTIE ]       outline neutre, 342px
Avec un autre joueur
```

⚠️ **`NOUVELLE PARTIE` remplace un ancien "Retour à l'accueil"** — décision
de session : personne ne "retourne à l'accueil" pour le plaisir, l'intention
réelle est de rejouer avec quelqu'un d'autre. Le libellé nomme l'intention,
pas la destination technique (qui reste `landing.ts` en interne).

### Logique de revanche symétrique (nouveau mécanisme, pas encore en prod)

**Constat de session, pas encore résolu dans le code actuel :** rien dans
`decisions.md` (D19) ne documente ce qui se passe si un seul joueur clique
"Revanche" — risque de recréer exactement le bug déjà corrigé sur `game.ts`
(D03, itération 2) où un joueur redémarre unilatéralement sans laisser le
temps à l'autre de répondre.

**Mécanisme à implémenter, par analogie directe avec `player_ready` :**
- Chaque joueur envoie son propre `rematch_ready` en cliquant sur son bouton
  (`REVANCHE` ou `ACCEPTER` selon qui a cliqué en premier)
- Redémarrage de la partie (retour à `game.ts`) seulement quand les deux
  ont envoyé `rematch_ready`
- **Pas de vrai système demande/accepte côté serveur** — la différence de
  libellé (`REVANCHE` vs `ACCEPTER`) est un affichage de courtoisie côté
  client, pas une nouvelle mécanique serveur

**État "Revanche envoyée" (celui qui a cliqué en premier) :**
```
VICTOIRE  (ou DÉFAITE — ce mécanisme s'applique dans les 2 cas)

En attente de ton adversaire…    ← remplace le bouton REVANCHE, plus
                                     de fond coloré, juste un statut

[ NOUVELLE PARTIE ]              ← reste cliquable, permet d'annuler
                                     et de repartir sur une nouvelle
                                     partie si l'autre ne répond pas
```

**État "Revanche reçue" (celui qui répond) :**
```
VICTOIRE  (ou DÉFAITE)

Ton adversaire souhaite une revanche   ← au-dessus du bouton, PAS "Le
                                           joueur A souhaite..." — jamais
                                           nommer A/B à l'écran

[ ACCEPTER ]                     ← même style que REVANCHE
                                     (accent-yellow-action) — c'est la
                                     même action au fond, pas de
                                     changement de couleur

[ NOUVELLE PARTIE ]              ← clic ici = déclin implicite, pas de
                                     bouton "Refuser" séparé
```

---

## 6. Factorisation recommandée

Plusieurs patterns se répètent identiquement à travers les écrans — à
extraire en composants/fonctions partagés plutôt que dupliqués :

### `TransitionStatus` (composant ou fonction de rendu partagée)
Le pattern "texte de statut + loader + délai avant navigation automatique"
apparaît à l'identique à 3 endroits :
- `create.ts` : B connecté → Préparation
- `join.ts` : Code validé → Préparation
- (potentiellement) `end.ts` : transition vers le countdown après double
  `rematch_ready`

Facteur commun : texte de statut (couleur variable selon contexte : vert
succès ou neutre), loader visuel, délai configurable, callback de
navigation à la fin. Un seul composant paramétré évite 3 implémentations
divergentes qui dériveraient dans le temps.

### `ReadyHandshake` (logique, pas juste visuel)
Le mécanisme "chacun clique indépendamment, action commune seulement quand
les deux ont cliqué" apparaît maintenant à 2 endroits avec la même forme :
- `game.ts` : `player_ready` → `activateGame()`
- `end.ts` : `rematch_ready` → redémarrage partie

Une fonction/hook générique `useSymmetricReadyState(localAction, onBothReady)`
qui gère `localReady`/`peerReady` et le déclenchement conditionnel éviterait
de réimplémenter cette logique de course déjà source d'un bug corrigé une
fois (D03) — mieux vaut la centraliser pour ne pas avoir à la corriger deux
fois si un edge case apparaît.

### Liste déroulante à item unique sélectionné (thème)
Le pattern "liste d'options avec un item actif (bordure/marqueur) + items
verrouillés (icône + style atténué)" n'a qu'un seul usage actuel (sélecteur
de thème) mais sa structure (ligne + état actif/verrouillé + séparateurs)
est assez générique pour être un composant `SelectableList` si d'autres
listes similaires apparaissent plus tard dans le projet.

### Boutons — variantes de style, pas de couleurs en dur
Tous les CTA du parcours suivent 3 variantes seulement :
- **Plein, couleur de rôle** (`cta-scanner`, code sur `create.ts`)
- **Plein, jaune neutre** (`Je suis prêt`, `REVANCHE`/`ACCEPTER`)
- **Outline neutre** (`NOUVELLE PARTIE`, boutons landing)

Un composant `Button` avec une prop `variant: 'role-a' | 'role-b' | 'action' | 'outline'`
plutôt que des couleurs codées en dur à chaque usage — cohérent avec
l'usage déjà fait des Text Styles/Color Styles côté Figma, à répercuter
côté code.

---

## 7. Points restés ouverts (non bloquants pour un premier passage d'implémentation)

- Durée exacte des états transitoires (600-800ms) — à valider par test réel,
  pas de blocage : implémenter avec une constante nommée, ajustable
- Contraste des couleurs (texte sur boutons colorés) — à vérifier avec un
  outil WCAG avant merge final (D21)
- Comportement au clic sur un thème verrouillé dans le sélecteur (rien ?
  message ? micro-animation de refus ?) — non tranché en session
- Icônes emoji (`📷`, `🔒`, `🎨`) utilisées comme placeholders wireframe —
  à redessiner en cohérence avec le langage visuel du logo (D24) avant
  production réelle, pas bloquant pour une première passe fonctionnelle
- Onboarding règles (Q12, toujours ouvert dans `decisions.md`) — ce document
  couvre le minimum actuel ("7 pts · marge 2" + instruction tilt), pas
  d'exploration plus poussée de Q12 faite en session

---

## 8. Ordre d'implémentation suggéré

1. Design tokens (couleurs, text styles) — base de tout le reste
2. `landing.ts` — le plus simple, valide la structure de base
3. `create.ts` + `join.ts` — en parallèle si possible, beaucoup de patterns
   partagés (transition, styles de bouton)
4. `game.ts` — le plus sensible, à tester particulièrement soigneusement
   contre l'historique D03 (risque de régression du bug déjà corrigé)
5. `end.ts` — inclut le nouveau mécanisme de revanche symétrique, qui
   n'existe pas encore dans le code actuel (à construire, pas juste à
   adapter visuellement)
