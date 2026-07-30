# Harnais de capture (outil dev)

Génère des captures **frame-perfect** de l'animation d'approche → spawn (D06)
sans avoir besoin d'un adversaire ni de synchroniser à la main. Utilisé pour
produire les visuels des posts LinkedIn (ex. épisode 8).

## Principe

Le mode capture court-circuite le réseau, le tilt, le wake lock et la boucle
`requestAnimationFrame` temps-réel. Il pilote `draw()` / `update()` (les vraies
fonctions de rendu du jeu) via une **horloge injectable** (`clock()` dans
`src/screens/game.ts`), en avançant un temps virtuel pas à pas. Ce qui est
capturé est donc exactement ce qu'un joueur voit.

Code : `runCapture()` dans `src/screens/game.ts` ; point d'entrée dans
`src/main.ts` (détection de `?capture=`).

## Utilisation

Lancer le serveur de dev (`npm run dev` dans `src/`), puis ouvrir une URL :

| URL | Résultat |
|---|---|
| `?capture=approach` | Triptyque approche / vide / BLAM en un PNG (affiché + téléchargé) |
| `?capture=approach&mode=frames` | Les 3 vignettes en PNG séparés |
| `?capture=approach&t=150` | Une seule frame au temps virtuel 150 ms |
| `?capture=approach&mode=seq` | Toute la séquence, frame par frame |

## Paramètres

| Paramètre | Défaut | Effet |
|---|---|---|
| `mode` | `triptych` | `triptych` \| `frames` \| `seq` |
| `t` | - | frame unique au temps virtuel donné (ms) |
| `frames` | `150,350,410` | keyframes du triptyque/frames (ms, séparés par virgule) |
| `nx` | `0.80` | position d'entrée x de la balle (0..1) ; 0.80 = tiers gauche, dégage le score |
| `clean` | `1` | masque l'overlay "Adversaire…" (`clean=0` pour le réafficher) |
| `labels` | off | `labels=1` ajoute les légendes sous les panneaux |
| `theme` | `arcade` | thème visuel |
| `step` | `2` | pas de simulation en ms |

## Repères temporels (constantes actuelles)

- `DEAD_ZONE_MS = 400` : fenêtre d'approche (indicateur visible ~300 ms + gap).
- `APPROACH_GAP_MS = 100` : vide entre disparition du point et arrivée de la balle.
- `BALL_SPAWN_MS = 80` : montée d'échelle de la balle au spawn (1,3× → 1×).

Keyframes par défaut : 150 ms (point ~1×, semi-transparent), 350 ms (le vide),
410 ms (balle à ~1,26×, le "BLAM").

## Notes

- Les PNG sont produits à `dpr = 1` sur un panneau portrait 620 × 1040 (réglable
  via `width` / `height`) pour des pixels nets et reproductibles.
- Le refactor `clock()` est sans effet sur le jeu réel (il renvoie `Date.now()`
  quand l'override n'est pas posé).
- Captures produites : `docs/captures/`.
