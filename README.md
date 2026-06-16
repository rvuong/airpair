# AirPair

Physical racket game for two smartphones, face to face. The ball crosses the invisible space between the two screens.

## Concept

Two players stand facing each other, each holding their phone in portrait mode. Each player sees their half of the court — their paddle at the bottom, the ball when it's in their zone. The ball leaves one screen and reappears on the other, like table tennis.

Control: tilt the phone left/right. First to 7 points wins.

## Play locally

Requirements: Node.js 24+

```bash
# WebSocket server (terminal 1)
cd server && npm install && npm start

# Client (terminal 2)
cd src && npm install && npm run dev -- --host
```

Open `https://<local-ip>:5173` on both phones (accept the self-signed certificate), or `http://localhost:5173` on PC.

## Stack

- **Client**: Vite + TypeScript, Canvas 2D, PWA → `src/`
- **Server**: Node.js + `ws`, ~100 lines → `server/`
- **Hosting**: GitHub Pages (client) · WebSocket server to be deployed separately

## Docs

- [`PROJECT.md`](PROJECT.md) — intent, concept, architecture, roadmap
- [`docs/decisions.md`](docs/decisions.md) — decision log (the why)
- [`docs/glossaire.md`](docs/decisions.md) — glossary
