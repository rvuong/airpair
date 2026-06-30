# Contributing to AirPair

## Prerequisites

- Node.js ≥ 20
- `npm install` at the root (client) and in `server/`
- To test on iPhone: local HTTPS via `@vitejs/plugin-basic-ssl` (accept the certificate once on the device)

## Running the project locally

```bash
# Client (port 5173, HTTPS)
npm run dev

# WebSocket server (port 8080)
cd server && npm run dev
```

The client connects to the local server by default. To test against the production server (`wss://ws.odomate.eu`), set `VITE_WS_URL` in `.env.local`.

## Git workflow

Trunk-based development — short-lived branches, merge via PR, never commit directly to `main`.

```
feat/description   # new feature
fix/description    # bug fix
chore/description  # tooling, CI, deps
docs/description   # documentation only
```

Required commit format ([Conventional Commits](https://www.conventionalcommits.org/)):

```
type(scope): short description
```

Types: `feat` · `fix` · `chore` · `docs` · `refactor` · `test`

Examples: `feat(game): add ball trail effect` · `fix(ios): unlock AudioContext on tap`

## Required documentation

Any PR that modifies a behaviour, a game parameter, or an architecture decision must include a note in the appropriate file — documentation travels in the same commit as the code.

| Change | Where to document |
|---|---|
| New architecture or design decision | New entry in [docs/decisions.md](./docs/decisions.md) |
| Game parameter tuning (speed, size, thresholds) | Amendment to the relevant decision in [docs/decisions.md](./docs/decisions.md) |
| Playtest result | [PROJECT.md](./PROJECT.md) (roadmap section) + relevant decision(s) |
| Roadmap or phase status change | [PROJECT.md](./PROJECT.md) |

An increment with no statement of intent is not mergeable.

## Creating a PR

Each PR must have:
1. A title in Conventional Commits format
2. A description: context, changes, link to [docs/decisions.md](./docs/decisions.md) if applicable

## Hard constraints — never violate

- **Deterministic simulation** — zero position streaming; one single message `{t_frappe, position, vecteur_vitesse}` per hit
- **Bundle ≤ 150 KB gzip** — checked in CI on every PR
- **WS traffic ≤ 20 KB/game** — checked in CI
- **Zero UI framework, zero game engine, zero WASM**

## References

- [PROJECT.md](./PROJECT.md) — intent, roadmap, current state
- [docs/decisions.md](./docs/decisions.md) — decision log (the WHY)
- [docs/glossaire.md](./docs/glossaire.md) — project-specific terms
