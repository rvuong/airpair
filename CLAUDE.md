# Pong Bros — contexte projet

**Phase actuelle : 0 (prototypes jetables)**
Proto 0a : tilt/contrôle, 1 téléphone, `proto/0a-tilt/`
Proto 0b : synchro réseau, 2 clients, `proto/0b-sync/`
Go/no-go projet = résultat 0a (3/4 personnes trouvent le tilt agréable en 30 s).

## Stack
Client : Vite + TypeScript, Canvas 2D, PWA
Serveur : Node.js + `ws`, ~100 lignes
Docs : `PROJECT.md` (intention + roadmap), `docs/decisions.md` (pourquoi des choix)

## Agents disponibles
- Code jeu (Canvas, tilt, boucle de jeu) → `game-dev`
- Serveur WebSocket → `server-dev`
- Worklog SCI → `sci-keeper`
- Épisode LinkedIn → `linkedin-writer`

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

**CI** (`.github/workflows/ci.yml`) — sur chaque PR vers `main` :
typecheck + build + bundle ≤ 150 Ko gzip (jobs conditionnels, skippés si package.json absent)

**Deploy** (`.github/workflows/deploy.yml`) — sur merge dans `main`, path `src/**` :
build Vite → GitHub Pages (`BASE_URL=/pongbros/`)
Activer dans Settings → Pages → Source → GitHub Actions avant le premier déploiement.

## iOS Safari — checklist (iPhone 11, cible de test)
`requestPermission()` capteurs dans handler de geste · AudioContext débloqué dans ce même geste · `touch-action: none` + `overscroll-behavior: none` + preventDefault touchmove · Wake Lock · portrait assumé · bouton silence coupe Web Audio → avertir visuellement
