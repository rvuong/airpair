# Contribuer à AirPair

## Pré-requis

- Node.js ≥ 20
- `npm install` à la racine (client) et dans `server/`
- Pour tester sur iPhone : HTTPS local via `@vitejs/plugin-basic-ssl` (certificat à accepter une fois sur l'appareil)

## Lancer le projet en local

```bash
# Client (port 5173, HTTPS)
npm run dev

# Serveur WebSocket (port 8080)
cd server && npm run dev
```

Le client se connecte par défaut au serveur local. Pour tester avec le serveur de prod (`wss://ws.odomate.eu`), modifier `VITE_WS_URL` dans `.env.local`.

## Workflow git

Trunk-based development — branches courtes, merge via PR, jamais de commit direct sur `main`.

```
feat/description   # nouvelle feature
fix/description    # correctif
chore/description  # tooling, CI, deps
docs/description   # documentation seule
```

Format de commit obligatoire ([Conventional Commits](https://www.conventionalcommits.org/)) :

```
type(scope): description courte
```

Types : `feat` · `fix` · `chore` · `docs` · `refactor` · `test`

Exemples : `feat(game): add ball trail effect` · `fix(ios): unlock AudioContext on tap`

## Documentation obligatoire

Toute PR qui modifie un comportement, un paramètre de jeu, ou une décision d'architecture doit inclure une note dans le fichier adéquat — la doc voyage dans le même commit que le code.

| Changement | Où documenter |
|---|---|
| Nouvelle décision d'architecture ou de design | Nouvelle entrée dans [docs/decisions.md](./docs/decisions.md) |
| Tuning d'un paramètre de jeu (vitesse, taille, seuils) | Amendement de la décision concernée dans [docs/decisions.md](./docs/decisions.md) |
| Résultat de playtest | [PROJECT.md](./PROJECT.md) (section roadmap) + décision(s) concernée(s) |
| Changement de roadmap ou d'état de phase | [PROJECT.md](./PROJECT.md) |

Un incrément sans note d'intention n'est pas mergeable.

## Créer une PR

Chaque PR doit avoir :
1. Un titre au format Conventional Commits
2. Une description : contexte, changements, lien vers [docs/decisions.md](./docs/decisions.md) si applicable

## Contraintes absolues à ne pas violer

- **Simulation déterministe** — zéro streaming de position ; un seul message `{t_frappe, position, vecteur_vitesse}` par frappe
- **Bundle ≤ 150 Ko gzip** — vérifié en CI à chaque PR
- **Trafic WS ≤ 20 Ko/partie** — vérifié en CI
- **Zéro framework UI, zéro moteur de jeu, zéro WASM**

## Références

- [PROJECT.md](./PROJECT.md) — intention, roadmap, état courant
- [docs/decisions.md](./docs/decisions.md) — journal de décisions (le POURQUOI)
- [docs/glossaire.md](./docs/glossaire.md) — termes spécifiques au projet
