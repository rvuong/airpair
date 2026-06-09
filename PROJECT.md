# Pong Bros. (nom de travail)

Pong physique à deux smartphones, face à face. La balle traverse l'espace réel
entre les deux écrans. Esprit : "je joue avec mon pote".

> Note nom : "PONG" est une marque Atari et "Bros." évoque Nintendo — sans
> risque pour un projet perso/repo, à renommer avant toute publication store.
> Alternatives en réserve : PingBros, PongPals, Bounce Bros, Face2Ball.

## Intention

Créer du fun par la magie d'un terrain de jeu qui déborde des écrans : deux joueurs
se font face, chacun tient son smartphone, et la balle quitte un écran pour
réapparaître sur l'autre, comme au tennis de table. Le plaisir naît de
l'interactivité physique réelle — gestes, sons, regards, présence de l'adversaire —
que le numérique augmente au lieu de la remplacer.

Le moment magique à protéger dans chaque décision : **la balle qui traverse
l'espace invisible entre les deux téléphones**. Tout le reste est secondaire.

## Concept de jeu

- 2 joueurs, face à face physiquement, chacun sur son smartphone (web, PWA).
- Chaque joueur voit sa moitié de terrain : sa raquette en bas, la balle quand
  elle est dans son camp. La moitié adverse n'est jamais affichée.
- Contrôle de la raquette par **inclinaison** du téléphone (tilt gauche/droite),
  téléphone tenu en main, en portrait.
- Entre les deux écrans : une **zone morte** invisible que la balle met ~400 ms
  à traverser (durée fonction de la vitesse). Source de tension, et tampon qui
  absorbe la latence réseau.
- Règles type tennis de table : 11 points, 2 points d'écart, service alterné
  tous les 2 points. La vitesse de balle augmente à chaque échange.
- Point marqué quand l'adversaire rate la balle.

## Décisions de design actées

- **Pas de localisation spatiale** (ni QR sur table, ni caméra, ni UWB).
  Orientation par convention : haut de mon écran = direction de l'adversaire,
  coordonnée horizontale inversée en miroir à la traversée.
- **Coprésence garantie par l'appairage** : QR code affiché sur l'écran du
  joueur A, scanné par le joueur B. Pas de mécanisme anti-jeu-à-distance.
- **Calibrage du tilt** au lancement (position neutre = tenue confortable),
  puis **compte à rebours synchronisé** "3, 2, 1" sur les deux écrans.
- **Audio = canal de feedback principal.** Le son de frappe adverse est entendu
  naturellement (coprésence) ; pas de relais réseau du son en MVP
  (replay atténué = phase 2, pour environnements bruyants).
- **Indicateur d'approche** : quand la balle revient vers moi, un point/ombre
  grandit en haut de mon écran sur le futur point d'entrée. Pas de pointeur de
  la balle quand elle est chez l'adversaire (préserve la tension et le regard
  vers l'adversaire réel).
- Abandonné : silhouette de l'adversaire, téléphone posé à plat, haptique (v1),
  effets de balle (post-MVP).

## Architecture technique

### Stack
- **Client** : Vite + TypeScript, Canvas 2D, PWA (manifest + service worker
  minimal). Pas de moteur de jeu, pas de WASM (jeu trivialement léger ; toutes
  les API critiques — capteurs, audio, WebSocket, caméra — sont côté JS).
- **Serveur (phase 1)** : Node + `ws`, ~100 lignes : rooms, relais de messages,
  handshake de synchronisation d'horloge. Hébergement tier gratuit
  (Render/Fly.io/Railway) ; migration AWS possible plus tard.
- **Hébergement client** : GitHub Pages (HTTPS natif, requis pour capteurs
  et caméra).
- **Dev local** : Vite en HTTPS sur réseau local (`@vitejs/plugin-basic-ssl`)
  pour tester sur iPhone sans déployer.
- **QR** : génération `qrcode` ; scan `BarcodeDetector` si dispo, fallback `jsQR`.

### Modèle réseau (principe clé)
- **Simulation déterministe identique sur les deux clients.** La trajectoire de
  la balle est entièrement calculable : on n'envoie jamais sa position en
  continu.
- À chaque frappe, un seul événement réseau :
  `{ t_frappe, position, vecteur_vitesse, (effet) }`. Le client adverse calcule
  la traversée et l'instant d'apparition.
- **Synchro d'horloge** au démarrage : handshake ping/pong type NTP simplifié,
  répété ~10 fois, médiane de l'offset. Cible : offset < 20 ms en WiFi local,
  < 50 ms en 4G. La zone morte (~400 ms) rend la latence réseau invisible.
- **Autorité distribuée** : le téléphone du camp où se trouve la balle décide
  seul "frappée ou ratée", puis notifie l'autre. Pas d'arbitre central.

### Contrôle au tilt (spec proto 0a)
1. Source : `deviceorientation`, lecture de `gamma` (roulis en portrait), ~60 Hz.
2. Calibrage : au tap "Jouer", `gamma0` = neutre. Commande = `gamma − gamma0`.
3. Courbe de réponse : zone morte ±1,5°, mapping vers la pleine course sur ±15°
   (post-playtest #2, réduit de 20°), exposant 1.1 (quasi-linéaire).
4. Lissage : passe-bas exponentiel, α = 0,45 (post-playtest #2, réduit de 0,3).
5. Re-centrage : bouton "recalibrer" + recalibrage auto avant chaque manche.
6. **Panneau de tuning à l'écran** pour zone morte / amplitude / exposant /
   lissage (itération en live).
- Fallback de contrôle et de debug : toucher (glisser le doigt).

### Pièges iOS (cible de test : iPhone 11, Safari)
- `DeviceOrientationEvent.requestPermission()` obligatoire, appelé dans le
  handler d'un geste utilisateur, HTTPS requis.
- `AudioContext` à créer/résumer dans ce même geste + jouer un son silencieux.
  Le bouton silencieux physique coupe le Web Audio : avertir l'utilisateur.
- Anti-scroll : `touch-action: none`, `overscroll-behavior: none`,
  `preventDefault` sur touchmove (bloquer pull-to-refresh et rebond).
- Wake Lock (`navigator.wakeLock.request('screen')`) pour éviter la mise en
  veille en partie.
- Pas de verrouillage d'orientation en web iOS : assumer le portrait, écran
  "tournez votre téléphone" si paysage.
- Vibration : `navigator.vibrate` non supporté sur iOS Safari → hors scope v1.

## Roadmap

### Phase 0 — Tuer les risques ✅
- **0a Contrôle** : validé. Tilt agréable et précis, valeurs par défaut retenues.
  Critère 3/4 : validé solo, à confirmer avec d'autres testeurs en parallèle de Phase 1.
- **0b Synchro** : validé. Connexion WS, relais bidirectionnel, handshake NTP opérationnels.
  Offset mesuré ~45 ms sur WiFi (dans la tolérance de la zone morte 400 ms).

### Phase 1 — MVP ✅ (livré le 8 juin 2026)
Appairage QR, compte à rebours synchronisé, boucle de jeu complète (service,
échange, score à 11), sons soignés (frappe, rebond, point, compte à rebours,
victoire/défaite), indicateur d'approche, bouton revanche avec alternance du
premier serveur, déploiement GitHub Pages.

**Serveur WS déployé le 9 juin 2026** : EC2 t4g.nano eu-west-1, `wss://ws.odomate.eu`,
TLS Let's Encrypt, CI/CD GitHub Actions.

→ Critère go/no-go phase 2 : "les joueurs redemandent-ils spontanément une revanche ?"

### Phase 2 — Sensation ← EN COURS (depuis le 9 juin 2026)
Playtests 5-10 paires. Tuning : vitesse de balle, taille de raquette, durée de
zone morte, gain du tilt. Toggles à trancher : replay atténué du son de frappe
adverse. Si latence du relais gênante : WebRTC DataChannel P2P (serveur =
signalisation seule).

**Playtest #1 (9 juin 2026)** : jeu trop lent, trop long.
Corrections mergées (feat/game-tuning-v1) :
vitesse initiale 0.45 → 0.60, accélération 1.06 → 1.10, score 11 → 7 pts (marge 2),
escalade du service +10% par point.

**Playtest #2 (9 juin 2026)** : vitesse OK. Balle trop petite. Tilt imprécis.
Corrections en cours (fix/ball-size-tilt-precision) :
balle 10 px → 25 px (test d'exagération, D20), tilt amplitude 20° → 15°,
exponent 1.4 → 1.1, alpha 0.3 → 0.45 (D03).

**Playtest #3 (9 juin 2026)** : balle 25 px trop grande → 20 px (−5 px, D20).
Textes illisibles → test ×2 polices petites (D21). Amorce accessibilité malvoyance.

**Playtest #3 bis (9 juin 2026)** : chevauchements après ×2 textes.
"Adversaire…" / "Tap pour servir" recouvraient la raquette → remontés au-dessus
(baseline `H − PADDLE_MARGIN − PADDLE_HEIGHT/2 − 16`). "Premier à 7 points ·
marge de 2" wrappait sur Pixel 7 → raccourci en "7 pts · marge 2".

### Phase 3 — Profondeur (selon résultats)
Effets de balle au gyroscope (coup de poignet = lift/coupé), modes de jeu,
juice audio-visuel, gestion déconnexions/reprises, garde-fous d'appairage
(expiration QR, comparaison IP), éventuelle migration AWS.
Thèmes visuels choisis par l'hébergeur (D22) : Terre battue · Gazon · Synthétique · JO Paris 2024.

## Organisation du repo

- `PROJECT.md` : ce fichier — intention, décisions, roadmap. Source de vérité
  sur l'état COURANT du projet. Court (< 200 lignes).
- `docs/decisions.md` : journal de décisions (format ADR allégé) — pour chaque
  sujet : contexte, options envisagées, décision, justification. C'est là que
  vit le POURQUOI (alternatives écartées comprises). Amendé quand une décision
  change, jamais réécrit en récit.
- Specs détaillées dans des fichiers dédiés au fil de l'eau :
  `docs/architecture.md`, `docs/netcode.md`, `docs/game-design.md`,
  `docs/sci.md` (mesure environnementale), `docs/linkedin.md` (série publique),
  `CONTRIBUTING.md`, etc.
- Prototypes phase 0 dans `proto/0a-tilt/` et `proto/0b-sync/` (code jetable,
  séparé du futur code MVP).
- Toute nouvelle décision de design ou d'architecture se reporte ici (sections
  "Décisions actées" / "Roadmap") pour garder ce fichier comme contexte
  d'entrée fiable.
