# AirPair — contexte projet

**Phase actuelle : 1 MVP ✅ — déployé sur https://rvuong.github.io/airpair/**
En attente de playtests. Critère go/no-go phase 2 : "les joueurs redemandent-ils spontanément une revanche ?"
Phase 1 livré : appairage QR · boucle de jeu (score à 7 après playtests) · sons · indicateur d'approche · revanche · deploy GitHub Pages

Phase 0 ✅ : `proto/0a-tilt/` (tilt) · `proto/0b-sync/` (synchro réseau)

## Stack
Client : Vite + TypeScript, Canvas 2D, PWA
Serveur : Node.js + `ws`, ~100 lignes
Docs : [PROJECT.md](./PROJECT.md) (intention + roadmap), [docs/decisions.md](./docs/decisions.md) (pourquoi des choix), [docs/glossaire.md](./docs/glossaire.md) (glossaire).

## Agents disponibles
- Code jeu (Canvas, tilt, boucle de jeu) → `game-dev`
- Serveur WebSocket → `server-dev`
- Worklog Software Carbon Index (SCI) → `sci-keeper`
- Assistant rédaction des épisodes LinkedIn → `linkedin-writer`

## Règles absolues
- Simulation déterministe : **zéro streaming de position**, un seul message `{t_frappe, position, vecteur_vitesse}` par frappe
- Zéro framework UI, zéro moteur de jeu, zéro WASM
- Bundle ≤ 150 Ko gzip · trafic WS ≤ 20 Ko/partie
- Chaque agent reçoit uniquement son contexte minimal (défini dans `.claude/agents/`)

## Workflow git
**Trunk-based development** — branches courtes, merge fréquent via PR, jamais commit direct sur `main`.
Nommage : `feat/description`, `fix/description`, `chore/description`

**Conventional commits** — format obligatoire :
`type(scope): description` — types : `feat` `fix` `chore` `docs` `refactor` `test`
Exemples : `feat(tilt): add live tuning panel` · `fix(ios): unlock AudioContext on gesture` · `chore(ci): add bundle size check`

**Semver** — version dans `package.json` + tag git `vX.Y.Z`
- Phase 0 : `0.1.x` (protos) · Phase 1 MVP : `0.2.0` · Go phase 2 : `0.3.0` · Go phase 3 : `1.0.0`
- Patch (`x`) : fix dans la phase · Minor (`y`) : fin de phase ou feature significative

**Création de PR** — via CLI (`gh pr create`) ou interface GitHub, au choix.
Chaque PR doit obligatoirement avoir :
1. Un titre au format Conventional Commits
2. Une description (contexte, changements, lien vers `docs/decisions.md` si applicable)

**Après merge d'une PR** — obligatoire, dans cet ordre :
1. `git checkout main`
2. `git pull origin main`
3. `git branch -d <branche-mergée>`

**CI** ([.github/workflows/ci.yml](./.github/workflows/ci.yml)) — sur chaque PR vers `main` :
typecheck + build + bundle ≤ 150 Ko gzip (jobs conditionnels, skippés si package.json absent)

**Deploy** ([.github/workflows/deploy.yml](./.github/workflows/deploy.yml)) — sur merge dans `main`, path `src/**` :
build Vite → GitHub Pages (`BASE_URL=/airpair/`)
Activer dans Settings → Pages → Source → GitHub Actions avant le premier déploiement.

## Contributing
**Chaque incrément doit être documenté.** Toute PR qui modifie un comportement,
un paramètre de jeu, ou une décision d'architecture doit s'accompagner d'une
note dans le fichier `.md` adéquat :
- Nouveau choix d'architecture ou de design → entrée dans [docs/decisions.md](./docs/decisions.md)
- Tuning de paramètre de jeu (vitesse, taille, seuils) → amendement de la
  décision concernée dans [docs/decisions.md](./docs/decisions.md)
- Résultat de playtest → `PROJECT.md` (section Phase 2) + décision(s) amendée(s)
- Changement de roadmap ou d'état de phase → [PROJECT.md](./PROJECT.md)

La doc voyage dans le même commit ou la même PR que le code. Un incrément sans
note d'intention n'est pas mergeable.

## iOS Safari — checklist (iPhone 11, cible de test)
`requestPermission()` capteurs dans handler de geste · AudioContext débloqué dans ce même geste · `touch-action: none` + `overscroll-behavior: none` + preventDefault touchmove · Wake Lock · portrait assumé · bouton silence coupe Web Audio → avertir visuellement
