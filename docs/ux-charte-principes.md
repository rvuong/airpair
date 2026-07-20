# AirPair — Charte UX & principes transversaux

Document complémentaire à `ux-redesign-spec.md` (qui détaille chaque écran).
Celui-ci capture les **règles** qui s'appliquent partout, pas le contenu
écran par écran. À consulter avant toute nouvelle décision d'interface,
pour ne pas re-débattre un principe déjà tranché.

---

## 1. Changements de règles par rapport à l'UX initiale

Ce qui suit n'existait pas ou fonctionnait différemment avant cette session
de refonte — à traiter comme des changements de comportement, pas de
simples retouches visuelles.

### 1.1 — Ne jamais nommer les rôles A/B à l'écran

**Avant :** le texte source de D03 utilisait littéralement "Le joueur A se
prépare…" / "Le joueur B se prépare…".

**Maintenant :** le joueur ne voit jamais la nomenclature interne A/B, nulle
part dans le parcours. On dit **"ton adversaire"**. La distinction A/B reste
un concept de code (rôle serveur, couleur assignée), jamais un mot affiché.

**Pourquoi :** A/B est une nomenclature technique qui n'a de sens que pour
qui lit le code. L'exposer à l'écran demande à l'utilisateur d'apprendre un
vocabulaire qui ne lui sert à rien.

### 1.2 — Nommer l'intention, pas la destination technique

**Avant :** un bouton "Retour à l'accueil" en fin de partie.

**Maintenant :** "Nouvelle partie" (sous-texte : "Avec un autre joueur").

**Pourquoi :** personne ne clique un bouton de fin de partie pour le
plaisir de "retourner à l'accueil" — soit on rejoue (revanche), soit on
change d'adversaire (nouvelle partie), soit on ferme l'app (aucun bouton
requis pour ça). Le libellé doit correspondre à ce que l'utilisateur *veut
faire*, même si techniquement le code navigue vers le même écran
`landing.ts` dans les deux cas (clic initial ou "nouvelle partie").

Ce principe s'applique rétroactivement à `landing.ts` lui-même :
"Créer une partie" / "Rejoindre" ont été jugés ambigus (ne disent pas quoi
on crée ou rejoint) → renommés en "Nouvelle partie" / "Rejoindre une
partie", chacun avec un sous-texte de 12-13px qui lève l'ambiguïté sans
alourdir l'écran.

### 1.3 — La couleur encode un rôle, jamais une fonction universelle

**Avant :** aucune règle explicite — un swap de couleur a révélé que les
couleurs de rôle (A/B) avaient été appliquées à l'envers par rapport au
Canvas de jeu réel (D22/Q13 : A=magenta, B=cyan).

**Maintenant :** deux règles fixées :
1. AirPair ne suit pas les conventions universelles d'interface
   (rouge=suppression, bleu=action) — c'est un choix assumé, cohérent avec
   une identité rétro-8-bit (D24) plutôt qu'un système fonctionnel type SaaS.
2. La seule sémantique de couleur qui existe est **le rôle du joueur**
   (A=magenta, B=cyan), et elle doit être strictement identique entre les
   écrans hors-jeu et le Canvas de jeu — jamais une couleur différente pour
   représenter le même rôle à deux endroits du produit.

**Corollaire : la couleur de rôle n'apparaît qu'une fois le rôle attribué.**
Sur `landing.ts`, avant que l'utilisateur ait choisi "nouvelle partie" ou
"rejoindre", aucun bouton ne porte de couleur de rôle — les deux CTA sont
visuellement identiques (style outline neutre). La couleur seulement
*confirme* un fait acquis, elle ne le préfigure jamais.

### 1.4 — Le thème visuel : discret, hérité, jamais imposé au premier plan

**Avant :** bouton "Terrain: Arcade ▾" pleine largeur, aussi visible que
le code/QR de connexion.

**Maintenant :**
- Icône discrète en coin d'écran (pas un bouton pleine largeur avec libellé)
- Présélection = **dernier thème joué**, pas systématiquement "Arcade" par
  défaut à chaque nouvelle partie
- Reste modifiable jusqu'au dernier moment (transition vers `game.ts`),
  changement le plus simple et discret possible

**Pourquoi :** le thème est une récompense de progression (D22 : débloqué
par victoire), pas une étape du parcours de connexion. Lui donner le même
poids visuel que le code/QR dilue à la fois la clarté de l'écran de
connexion et la valeur perçue du déblocage.

### 1.5 — Les transitions automatiques doivent être visibles, jamais silencieuses

**Avant :** un état "B connecté" qui restait affiché indéfiniment sans
suite visible, ou une transition immédiate qui donnait l'impression d'un
bug/écran qui saute.

**Maintenant :** toute transition automatique (sans clic utilisateur) passe
par un état transitoire explicite : texte de statut + indicateur de
chargement, pendant une durée courte et volontaire (600-800ms, à valider
par test réel), avant de naviguer vers l'écran suivant.

**Pourquoi :** l'absence de signal pendant un traitement, même bref, se lit
comme "il ne se passe rien" plutôt que "quelque chose se prépare". Un
signal transitoire, même minimal, suffit à rassurer sans transformer la
transition en moment spectaculaire (un fondu animé complexe a été envisagé
puis écarté — jugé "over-designé" pour ce qui doit rester un non-événement
du point de vue de l'utilisateur).

### 1.6 — Toute action à double confirmation suit le pattern symétrique de `game.ts`

**Avant :** seul `game.ts` (D03) avait résolu ce problème — un joueur ne
doit jamais pouvoir déclencher une action commune avant que l'autre ait eu
l'occasion de répondre.

**Maintenant :** ce principe s'étend à toute situation où deux joueurs
doivent converger vers un état commun. Découvert en construisant `end.ts` :
la revanche (D19) n'avait jamais formalisé ce mécanisme — si A clique
"Revanche" seul, la partie ne doit **pas** redémarrer unilatéralement.

**Règle générale, réutilisable pour toute future fonctionnalité à deux
joueurs :** chaque joueur envoie son propre signal de prêt/accord,
indépendamment de l'autre ; l'action commune ne se déclenche que quand les
deux signaux sont reçus. Le libellé affiché peut différer selon qui a
cliqué en premier (`REVANCHE` vs `ACCEPTER`) pour des raisons de clarté,
mais il n'existe **pas** de vrai système demande/accepte côté serveur —
c'est le même signal, affiché différemment selon le contexte local.

### 1.7 — La défaite reste neutre, jamais alarmante

**Avant :** aucune règle explicite, risque par défaut d'utiliser une
couleur d'alerte (rouge) pour "DÉFAITE".

**Maintenant :** "DÉFAITE" s'affiche en blanc/neutre, jamais en rouge ou
une autre couleur d'alarme. Perdre fait partie du jeu, ce n'est pas une
erreur système à signaler comme telle.

---

## 2. Règles à appliquer systématiquement (nouvelles surfaces, nouveaux écrans)

Ces règles ne sont pas propres à un écran précis — elles doivent guider
toute nouvelle interface ajoutée au produit à l'avenir.

### 2.1 — Jamais de bouton de démarrage manuel pour une action à deux joueurs

Le seul déclencheur légitime d'une transition partagée est la convergence
de deux signaux indépendants (voir 1.6). Aucun joueur ne doit avoir de
bouton "Démarrer pour les deux" — ce pattern a déjà produit un bug réel
(D03, itération 2) et ne doit pas être réintroduit sous une autre forme.

### 2.2 — Toujours garder un chemin de sortie visible vers le fallback

Chaque fois qu'une action principale dépend d'une permission ou d'une
capacité qui peut échouer (caméra, capteur de tilt), le chemin alternatif
(saisie manuelle, contrôle tactile) doit rester **visible et accessible**
à tout moment, jamais caché derrière un échec silencieux uniquement.

### 2.3 — Une seule permission système par geste utilisateur

Ne jamais coupler deux demandes de permission natives (caméra + capteur)
sur un même clic — même si ça semble plus "efficace" à première vue,
l'empilement de 2 popups consécutifs a été testé et confirmé confus (D03).
Chaque permission se demande sur le geste précis qui en a besoin, à son
propre moment du parcours.

### 2.4 — Minimalisme du texte : ne pas sur-expliquer un choix déjà fait

Une fois qu'un utilisateur a fait un choix explicite (cliqué un bouton,
confirmé un état), l'écran suivant ne doit pas revenir dessus avec du texte
justificatif. Exemple : l'écran de countdown (3, 2, 1) n'affiche rien
d'autre que le chiffre — les deux joueurs savent déjà ce qui arrive,
ajouter "Préparez-vous !" serait redondant.

### 2.5 — Pas d'emoji en production

Les emoji (`📷`, `🔒`, `🎨`) sont acceptés comme placeholders de wireframe
mais doivent être redessinés en cohérence avec le langage visuel du logo
(D24) avant toute mise en production — leur rendu varie selon l'OS
(Apple/Google/Windows), ce qui casse la cohérence d'identité que la
charte graphique (§3) cherche à garantir.

### 2.6 — Centrer verticalement les états à contenu minimal

Un écran ou une portion d'écran qui n'a que peu de chose à afficher (état
de transition, confirmation brève) doit centrer son contenu verticalement
dans tout l'espace disponible, plutôt que de le laisser ancré en haut avec
un vide en dessous. Un vide en bas se lit comme "il manque du contenu" ; un
espace équilibré en haut et en bas se lit comme "état de pause
intentionnel".

### 2.7 — Convention d'alignement (voir grille, §3.4) non négociable

Tout nouvel écran doit respecter les marges de 24px et la largeur de 342px
pour les éléments pleine largeur, dès la première itération — pas de
valeur approximative à corriger après coup (piège déjà rencontré : 320px
halluciné puis corrigé partout).

### 2.8 — Les tailles de texte sont relatives à l'écran, jamais figées en px

Les valeurs en px du tableau typographique (§3.3) sont **indicatives**,
calculées pour le frame de référence 390×844px (iPhone 14/15 Pro, voir §3.4).
Elles ne doivent jamais être codées en dur en `px` dans le CSS — sinon le
rendu se dégrade sur les écrans plus petits que le frame de référence (texte
trop grand, débordement, wrap involontaire) ou plus grands (texte
proportionnellement trop petit, incohérence entre écrans hors-jeu).

**Implémentation attendue :** un `font-size` racine qui s'échelonne avec la
largeur de viewport (`clamp()` borné, base ~16px à 390px de large — ex.
`html { font-size: clamp(14px, 4.1vw, 19px) }`), et tous les styles du
tableau exprimés en `rem` relatifs à cette racine plutôt qu'en `px` absolus.
Objectif : un rendu proportionnellement identique et homogène sur tout écran
de smartphone, sans multiplier les media queries par palier de taille.

---

## 3. Charte graphique

### 3.1 — Couleurs

| Token | Hex | Rôle |
|---|---|---|
| `bg-primary` | `#080818` | Fond principal, tous écrans hors-jeu |
| `accent-role-A` | `#ff2d78` (magenta) | Rôle A (hôte) — identique au Canvas de jeu |
| `accent-role-B` | `#00d4e8` (cyan) | Rôle B (invité) — identique au Canvas de jeu |
| `accent-yellow-action` | `#ffe44d` | Action neutre, ni A ni B (countdown, "Je suis prêt", revanche) |
| `accent-green-success` | `#39ff14` | Confirmation/succès — seule exception à la règle "pas de convention universelle" (voir 3.2) |
| `text-secondary` | gris moyen (hex à vérifier contraste) | Texte discret, statut neutre |

**Origine des couleurs de rôle et d'action :** extraites directement de
`src/assets/logo.svg` — pas une palette inventée séparément. Cyan et
magenta viennent du wordmark ("Air" cyan, "Pair" magenta dans le logo,
mais **attention** : l'assignation de rôle A/B suit le Canvas de jeu
existant, pas l'ordre du wordmark — voir 1.3). Le jaune vient du point
central de l'icône (symbolisant la balle).

### 3.2 — Exception au principe "pas de convention universelle" : le vert

Le vert `accent-green-success` est le seul ajout qui suit une convention
universelle (vert = succès), en rupture assumée avec le principe 1.3.
Justification : il ne concurrence aucune couleur de rôle, la reconnaissance
est quasi instinctive même hors contexte gaming, et il n'existe pas
d'équivalent dans le Canvas de jeu actuel avec lequel il pourrait entrer en
conflit.

### 3.3 — Typographie

Police système uniquement (`system-ui`/`-apple-system`/`Roboto`), aucune
police custom chargée — cohérent avec D10/D24 (pas de dépendance runtime
superflue).

**Tailles indicatives, à convertir en unités relatives — voir §2.8.** La
colonne "Taille indicative" donne la valeur de référence au frame 390px ;
la colonne "rem" donne l'équivalent à coder, relatif à une racine ~16px.

| Style | Taille indicative (px @ 390px) | rem (base 16px) | Graisse | Line-height | Usage |
|---|---|---|---|---|---|
| `text-display` | 36px | 2.25rem | Bold | 140% | Élément le plus important, rare (ex. code de partie avant fusion avec QR) |
| `text-cta` | 16px | 1rem | Bold | 140% | Libellé de bouton d'action |
| `text-body` | 18px | 1.125rem | Regular | 140% | Instruction, contenu principal lisible |
| `text-secondary` | 14px | 0.875rem | Regular | 130% | Info secondaire, sous-texte, statut neutre, tagline |
| `text-status-success` | 14px | 0.875rem | Bold | 140% | Confirmation positive (vert) |
| `text-link` | 14px | 0.875rem | Regular, souligné | 140% | Élément cliquable secondaire (fallback) |

**Countdown (3, 2, 1) :** hors charte standard — taille 120-140px, dédiée à
cet unique usage, pas de style réutilisable ailleurs.

**Contrainte d'accessibilité (D21, déjà actée projet, s'applique aussi
hors-Canvas) :** contraste ≥ 4,5:1 pour texte < 24px, ≥ 3:1 pour texte
≥ 24px ou gras ≥ 18,5px. `text-secondary` est le style le plus à risque de
tomber sous le seuil — à vérifier avec un outil (WebAIM ou équivalent)
avant mise en production, pas encore fait au stade wireframe.

### 3.4 — Grille et alignement

- Frame de référence : **390×844px** (iPhone 14/15 Pro)
- Marges latérales fixes : **24px** de chaque côté, sur tous les écrans
- Largeur utile pour tout élément pleine largeur : **342px** exactement
  (390 − 24 − 24) — jamais une valeur approchée
- Éléments à taille fixe (icônes, QR, code court) : **centrés
  horizontalement**, pas étirés à la largeur utile
- Touch targets : **≥ 44×44px** minimum (Apple HIG, WCAG 2.5.5 AAA, D21)

### 3.5 — Coins arrondis

- Boutons : **12px** sur les 4 coins
- Panneaux de liste (dropdown, menu) : **8px** uniquement sur les coins du
  bas quand le panneau est directement accolé sous un déclencheur (bouton
  ou icône) sans espace — les coins du haut restent à 0 pour que la
  jonction se lise comme un seul objet continu, pas deux éléments
  superposés

### 3.6 — Ombres

Un panneau flottant qui n'est pas visuellement rattaché à un bloc de même
fond (ex. dropdown de thème ancré à une icône plutôt qu'à un bouton pleine
largeur) reçoit une ombre portée discrète (drop shadow, décalage vertical
léger, flou 8-12px, noir à faible opacité) pour signaler qu'il flotte
au-dessus du reste de l'écran.

### 3.7 — Composants de liste (sélection à item unique)

Pattern validé pour toute liste où un seul item est actif parmi plusieurs
(ex. sélecteur de thème) :
- **Item actif :** bordure gauche épaisse (3-4px) en couleur d'action
  (`accent-yellow-action`), fond légèrement éclairci par overlay blanc à
  faible opacité (5-8%) plutôt qu'une couleur de fond différente
- **Items verrouillés/inactifs :** icône de verrou + texte en
  `text-secondary` à opacité réduite (~50%)
- **Séparateurs :** trait fin 1px, blanc à 8-10% d'opacité, entre chaque
  item
- Alignement du texte : **à gauche**, avec padding constant, jamais centré
  (un item de liste n'est pas un bouton)

---

## 4. Ce que cette charte ne couvre pas (hors scope, explicitement)

- Le Canvas de jeu lui-même (thèmes visuels D22, HUD, effets D25) — sa
  charte propre existe déjà et n'est pas remise en cause ici
- Les icônes redessinées pour remplacer les emoji (§2.5) — reste à
  produire, pas encore de spec visuelle définie
- L'exploration de Q12 (onboarding des règles) au-delà du minimum actuel
  ("7 pts · marge 2" + une ligne d'instruction) — question restée ouverte,
  non traitée en profondeur pendant cette session
