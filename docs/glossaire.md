# Glossaire AirPair

Termes utilisés dans la documentation du projet, groupés par domaine.
Chaque terme possède une ancre nommée : utilisez `[terme](#ancre)` pour créer un lien depuis n'importe quel fichier du dépôt.

Exemples de liens vers ce glossaire :
- Depuis un fichier dans `docs/` : `[lerp](./glossaire.md#lerp)`
- Depuis la racine du dépôt (ex. `PROJECT.md`) : `[lerp](./docs/glossaire.md#lerp)`

---

## Game design

### Alpha

**α — coefficient de lissage exponentiel du tilt.** Paramètre entre 0 et 1 qui contrôle le filtre passe-bas appliqué à la lecture brute du capteur. Un alpha faible lisse beaucoup mais introduit du lag ; un alpha élevé suit fidèlement les mouvements mais amplifie les tremblements. Valeur actuelle : 0,45 (voir [D03](./decisions.md)).

Formule : `valeur_lissée = α × lecture_brute + (1 − α) × valeur_lissée_précédente`

### Calibrage

Mise à zéro du tilt au démarrage. Au moment de taper "Jouer", la position courante du téléphone est enregistrée comme neutre (`gamma0`). La commande de raquette devient ensuite `gamma − gamma0`. Nécessaire car la "tenue confortable" varie d'un joueur à l'autre. Recalibrage automatique avant chaque manche ; bouton manuel disponible. Voir [D03](./decisions.md).

### Escalade du service

Mécanique selon laquelle la vitesse du service augmente d'un facteur fixe (+10 %) à chaque point joué, indépendamment du nombre de frappes dans l'échange. Effet : la partie s'emballe progressivement depuis le service lui-même, pas seulement pendant les échanges. La vitesse est remise à la valeur de base (`INITIAL_SPEED`) à chaque revanche. Voir [D13](./decisions.md).

### Exposant

Paramètre de la courbe de réponse du tilt. Un exposant de 1,0 donne un mapping linéaire (commande proportionnelle à l'angle) ; au-dessus de 1,0, la réponse s'accentue sur les grandes inclinaisons et est plus douce sur les petites. Valeur actuelle : 1,1 (quasi-linéaire, retenue après playtest #2 — l'exposant 1,4 était perçu comme imprévisible). Voir [D03](./decisions.md).

### Indicateur d'approche

Repère visuel affiché en haut de l'écran du récepteur pendant la traversée de la [zone morte (jeu)](#zone-morte-jeu), indiquant la position horizontale d'arrivée de la balle. L'indicateur grossit à mesure que la balle approche. Compromis entre information d'équité ("je pouvais savoir où elle arrivait") et préservation de la tension : il ne révèle pas la position de la balle chez l'adversaire, seulement son point d'entrée futur. Voir [D06](./decisions.md).

### Juice

Terme de game design désignant les retours sensoriels (visuels, sonores) qui donnent du poids et de la vie aux actions sans modifier les règles du jeu. Exemples : [squash/stretch](#squashstretch) de la balle à l'impact, [traînée](#traînée), flash au rebond, sons percussifs. Le juice amplifie la physicalité sans changer la stratégie.

### Lerp

**Interpolation linéaire.** Calcul d'une valeur intermédiaire entre A et B selon un facteur t ∈ [0, 1] : `lerp(A, B, t) = A + t × (B − A)`. Dans AirPair, utilisé pour l'accélération de la balle : `vitesse += (MAX − vitesse) × LERP_FACTOR`. Avec un facteur 0,20, la vitesse parcourt 20 % de la distance restante au plafond à chaque frappe — courbe logarithmique qui donne des gains forts au début et décroissants à l'approche du plafond. Voir [D13](./decisions.md).

### Marge

Nombre de points d'écart minimum requis pour remporter la manche. Avec une marge de 2, gagner à 7-5 est valide ; gagner à 7-6 ne l'est pas (il faut atteindre 8-6, 9-7, etc.). Correspond à la règle de l'avantage au tennis de table. Voir [D13](./decisions.md).

### Moment magique

Expression centrale du projet désignant l'expérience à protéger dans chaque décision de design : **la balle qui traverse l'espace invisible entre les deux téléphones**. Étalon d'arbitrage : tout choix est évalué à l'aune de ce moment. Voir [PROJECT.md](../PROJECT.md).

### Playtest

Session de test avec de vrais joueurs dans des conditions réelles. Chaque playtest produit un feedback qualitatif (verbatim) utilisé pour tuner les paramètres de jeu. Les sessions sont numérotées chronologiquement et documentées dans [PROJECT.md](../PROJECT.md) et [docs/decisions.md](./decisions.md).

### Prédiction de trajectoire

Affichage de la trajectoire *future* de la balle — positions à venir. Contrairement à la [traînée](#traînée), c'est une décision de gameplay : elle donne une information stratégique et neutralise la tension de l'invisible — le joueur "lit" l'arrivée avant qu'elle se produise. En contradiction directe avec [D06](./decisions.md). Charge de la preuve inversée : un playtest doit démontrer un bénéfice clair avant toute implémentation.

### Squash/stretch

<a id="squashstretch"></a>Effet de déformation d'un objet à l'impact : la balle s'aplatit brièvement (squash) puis reprend sa forme (stretch). Principe classique d'animation (12 principes Disney). Donne du poids et de la physicalité à la balle sans modifier les règles. Classé [juice](#juice) — distinct des effets de trajectoire au gyroscope ([D14](./decisions.md)).

### Tilt

Mode de contrôle principal d'AirPair. Le joueur incline le téléphone à gauche ou à droite (rotation gauche/droite en portrait) ; l'angle mesuré pilote la position horizontale de la raquette. Fiable car basé sur l'orientation absolue du gyroscope — pas de dérive contrairement à l'accéléromètre. Voir [D03](./decisions.md).

### Traînée

**Trail.** Effet visuel consistant à afficher les N positions passées de la balle avec une opacité décroissante. Pur [juice](#juice) : renforce la physicalité de la balle sans révéler d'information sur la moitié adverse. À ne pas confondre avec la [prédiction de trajectoire](#prédiction-de-trajectoire), qui montre les positions *futures*.

### Zone morte (capteur)

<a id="zone-morte-capteur"></a>Plage d'angle de tilt (±1,5° actuellement) en-dessous de laquelle aucune commande n'est transmise à la raquette. Évite que les micro-mouvements involontaires de la main au repos déplacent la raquette. Terme courant en game design : *dead zone*. Voir [D03](./decisions.md).

### Zone morte (jeu)

<a id="zone-morte-jeu"></a>Espace invisible entre les deux écrans, que la balle met ~400 ms à traverser (durée variable selon la vitesse). Pendant cette traversée, la balle n'est affichée sur aucun écran. Double rôle : (1) élément de design — tension et anticipation ; (2) tampon qui rend une latence réseau de 30-100 ms totalement imperceptible. Voir [D01](./decisions.md), [D04](./decisions.md).

---

## Technique

### AudioContext

Interface de l'API Web Audio (navigateur). Doit être créé ou repris (`resume()`) dans le handler d'un geste utilisateur sur iOS Safari — sinon les sons sont bloqués silencieusement. Le bouton silence physique de l'iPhone coupe le Web Audio entier, indépendamment du volume système. Voir [D08](./decisions.md), [D12](./decisions.md).

### Autorité distribuée

Principe d'arbitrage réseau : le téléphone dont c'est le camp décide seul si la balle est frappée ou ratée, puis notifie l'autre. Aucun arbitre central côté serveur. Simplifie l'architecture et évite un aller-retour réseau sur chaque frappe. Voir [D04](./decisions.md).

### BarcodeDetector

API navigateur permettant de détecter et décoder des codes-barres (dont QR codes) directement depuis une image ou un flux vidéo. Disponible sur Chrome Android et Safari iOS récents ; absent de Firefox. `jsQR` est utilisé comme fallback. Voir [D05](./decisions.md).

### Bundle

Ensemble des fichiers JavaScript et CSS produits par [Vite](#vite) lors du build, servis au navigateur. La taille gzippée est la métrique principale de poids — budget CI : ≤ 150 Ko gzip. Voir [gzip](#gzip).

### Canvas 2D

API de dessin HTML5 (`<canvas>`) permettant de rendre des formes, textes et images pixel par pixel via JavaScript. Utilisée pour tout le rendu de jeu dans AirPair (balle, raquettes, scores, indicateurs, thèmes visuels). Chaque frame est entièrement redessinée (~60 fps) : fond, terrain, pictogrammes décoratifs, raquettes, balle, textes d'état — il n'y a pas de scène persistante, tout est recalculé à chaque tick. Les éléments Canvas ne sont pas dans le DOM : ARIA, focus clavier et reflow ne s'y appliquent pas (voir [D21](./decisions.md)). Rendu géré dans `src/screens/game.ts`.

### deviceorientation

Événement navigateur émis ~60 Hz, fournissant l'orientation absolue de l'appareil en trois angles : alpha (cap), beta (tangage), gamma (roulis). AirPair utilise [`gamma`](#gamma) pour le tilt. Sur iOS Safari, nécessite un appel explicite à `DeviceOrientationEvent.requestPermission()` dans un handler de geste utilisateur (HTTPS requis). Voir [D03](./decisions.md), [D12](./decisions.md).

### Gamma

**γ — angle de roulis du téléphone en mode portrait.** Fourni par l'événement [deviceorientation](#deviceorientation). Varie de −90° (incliné à gauche) à +90° (incliné à droite), 0° à la verticale. Seule valeur utilisée pour le tilt dans AirPair.

### Handshake NTP

Protocole de synchronisation d'horloge entre les deux clients, inspiré du Network Time Protocol. Au démarrage, ~10 échanges ping/pong sont effectués ; la médiane de l'[offset d'horloge](#offset-dhorloge) est retenue. Cible : offset < 20 ms sur WiFi local, < 50 ms en 4G. La [zone morte (jeu)](#zone-morte-jeu) de ~400 ms rend cet offset imperceptible en pratique. Voir [D04](./decisions.md).

### jsQR

Bibliothèque JavaScript de décodage de QR codes fonctionnant entièrement côté client, sans API navigateur. Utilisée en fallback quand [BarcodeDetector](#barcodedetector) n'est pas disponible. Voir [D05](./decisions.md).

### Knockout typographique

**Clearance.** Technique consistant à interrompre une ligne horizontale de part et d'autre d'un texte qu'elle traverserait, en laissant une marge de quelques pixels entre le bord du texte et le début/fin de chaque segment. Assure la lisibilité sans repositionner ni la ligne ni le texte — les deux restent sur le même axe Y. Courante en cartographie (labels de routes sur un fond), HUDs de jeux et design éditorial. Dans AirPair : la ligne pointillée du seuil adverse s'interrompt autour du score. Implémentation [Canvas 2D](#canvas-2d) : `ctx.measureText()` mesure la largeur du texte courant, deux segments sont tracés de `0 → centre − textWidth/2 − marge` et de `centre + textWidth/2 + marge → W`.

### Offset d'horloge

Écart mesuré entre l'horloge locale d'un client et l'horloge de référence (serveur), exprimé en millisecondes. Calculé lors du [handshake NTP](#handshake-ntp) : `offset ≈ (t_retour − t_envoi) / 2 − t_serveur`. Chaque client corrige ses timestamps par cet offset pour que les événements de jeu soient interprétés au bon moment par les deux appareils.

### PWA

**Progressive Web App.** Application web installable sur l'écran d'accueil, fonctionnant comme une app native (plein écran, icône, chargement hors-ligne via [service worker](#service-worker)). Requiert HTTPS, un manifest `.webmanifest` et un service worker. Dans AirPair : nécessaire pour accéder à `DeviceOrientationEvent.requestPermission()` et pour un rendu plein écran sans barre d'adresse. Voir [D10](./decisions.md), [D24](./decisions.md).

### RTT

**Round-Trip Time.** Durée mesurée entre l'envoi d'un message et la réception de sa réponse. Utilisé dans le [handshake NTP](#handshake-ntp) pour estimer la latence réseau : `offset ≈ RTT / 2`. Un RTT de 60 ms en WiFi donne un offset estimé à 30 ms.

### Service worker

Script JavaScript s'exécutant en arrière-plan dans le navigateur, interceptant les requêtes réseau. Utilisé dans AirPair pour le cache [PWA](#pwa) : après la première visite, les assets sont servis localement, réduisant le trafic réseau à quasi zéro. Voir [docs/sci.md](./sci.md) B2.

### Simulation déterministe

Principe selon lequel la trajectoire de la balle est entièrement calculable à partir d'un état initial (position, vitesse au moment d'une frappe). Les deux clients exécutent la même simulation localement : aucun échange de position en continu n'est nécessaire — un seul message réseau par frappe. Voir [D04](./decisions.md).

### Vite

Outil de build JavaScript (bundler + serveur de développement). Produit le [bundle](#bundle) client d'AirPair. Support TypeScript natif ; plugin HTTPS local (`@vitejs/plugin-basic-ssl`) pour tester sur iPhone en réseau local sans déploiement. Voir [D10](./decisions.md).

### Wake Lock

API navigateur (`navigator.wakeLock.request('screen')`) qui empêche l'écran du téléphone de se verrouiller automatiquement. Activé dès le début d'une partie — sans elle, l'iPhone passe en veille après 30-60 s sans interaction tactile. Voir [D12](./decisions.md).

### WASM

**WebAssembly.** Format binaire exécutable dans le navigateur à vitesse quasi native. Écarté pour AirPair (voir [D10](./decisions.md)) : le jeu est computationnellement trivial, et toutes les API critiques (capteurs, audio, WebSocket) sont uniquement accessibles depuis JavaScript.

### WebSocket

Protocole de communication bidirectionnelle persistante sur TCP (`ws://` ou [`wss://`](#wss) en version sécurisée). Utilisé pour le relais de messages entre les deux clients via le serveur Node.js. Overhead très faible par message comparé à HTTP. Voir [D05](./decisions.md).

### wss

**WebSocket Secure.** Variante chiffrée (TLS) du protocole [WebSocket](#websocket), équivalent de HTTPS pour les WebSockets. Obligatoire en production car les navigateurs bloquent les connexions `ws://` (non chiffrées) depuis des pages servies en HTTPS.

---

## Usages non évidents

### ADR

**Architecture Decision Record.** Format de documentation d'une décision technique ou de design : contexte → options envisagées → décision → justification → implications. Le fichier [`docs/decisions.md`](./decisions.md) suit un format ADR allégé, avec numérotation Dxx et statut (✅ acté, 🔬 à valider, ⏸ reporté, ❌ écarté). Voir [D16](./decisions.md).

### Boavizta

Initiative open source fournissant des APIs et bases de données pour estimer l'empreinte carbone des équipements informatiques (fabrication + usage). Utilisé dans AirPair pour le poste M ([embodied](#embodied)) des smartphones et du matériel de dev dans le calcul SCI. Voir [docs/sci.md](./sci.md).

### ccusage

Outil CLI (`npx ccusage@latest`) mesurant la consommation de tokens des sessions Claude Code à partir des logs locaux (`~/.claude/projects/`). Utilisé dans AirPair pour quantifier le coût en tokens — et en CO₂e estimé — de l'usage de l'IA dans la réalisation du projet. Voir [docs/sci.md](./sci.md) volet A.

### CO2.js

Bibliothèque JavaScript de The Green Web Foundation convertissant un volume de données réseau (octets) en émissions de CO₂e, selon un modèle de consommation énergétique du réseau. Utilisé dans AirPair pour le volet B2 (réseau) du calcul [SCI](#sci).

### Conventional Commits

Convention de nommage des messages de commit : `type(scope): description`, où `type` est `feat`, `fix`, `chore`, `docs`, `refactor` ou `test`. Format obligatoire dans AirPair. Facilite la lecture de l'historique git et la génération de changelogs. Voir [CLAUDE.md](../CLAUDE.md).

### EcoIndex

Score environnemental d'une page web (0-100, grade A à G), basé sur le nombre d'éléments DOM, le poids de la page et le nombre de requêtes HTTP. Cible AirPair : grade A. Vérifié manuellement à chaque release via l'extension GreenIT-Analysis. Voir [docs/sci.md](./sci.md).

### Embodied

**Carbone incorporé — poste M dans la formule [SCI](#sci).** Émissions de CO₂e liées à la fabrication du matériel (smartphones, ordinateur de dev, serveur), amorties sur la durée de vie estimée de l'appareil et la durée d'usage effective. Dans AirPair, poste dominant attendu côté terminaux (~70-80 kgCO₂e pour un iPhone de cette génération, proratisé par partie jouée). Voir [docs/sci.md](./sci.md) B1.

### go/no-go

Décision binaire à un jalon : continuer vers la phase suivante (go) ou arrêter/pivoter (no-go). Le critère est défini *avant* de voir les résultats pour éviter le biais de confirmation. Critère phase 2 d'AirPair : "les joueurs redemandent-ils spontanément une revanche ?" Voir [PROJECT.md](../PROJECT.md).

### gzip

Algorithme de compression utilisé pour mesurer le poids réel du [bundle](#bundle) servi au navigateur. La contrainte "≤ 150 Ko gzip" correspond à la taille compressée telle que reçue par le navigateur — c'est la métrique pertinente car les serveurs compressent à la volée avant envoi.

### Impact Framework

Outil open source de la Green Software Foundation permettant de modéliser et calculer le [SCI](#sci) d'une application via un manifest YAML versionné ([`sci/manifest.yaml`](../sci/manifest.yaml)). Une commande unique recalcule le SCI en assemblant les observations mesurées avec les facteurs d'émission définis dans [`sci/factors.yaml`](../sci/factors.yaml). Voir [docs/sci.md](./sci.md).

### Propriété intellectuelle (risque IP)

**IP = Intellectual Property.** Ensemble des droits exclusifs attachés à une création : marques déposées, logos, noms commerciaux, chartes graphiques protégées par le droit d'auteur. Le "risque IP" désigne le danger d'utiliser ces éléments sans autorisation du titulaire des droits — ce qui peut entraîner une mise en demeure ou une action en contrefaçon, même pour un projet non commercial.

Dans AirPair : le thème initialement nommé "JO Paris 2024" a été renommé "Nostalgie 2024" (voir [D22](./decisions.md)) pour éviter d'associer le produit à une marque déposée (les Jeux Olympiques, le comité Paris 2024). L'inspiration graphique (Art Déco, palette or/rose, motifs géométriques) est licite car les idées et styles ne sont pas protégés — seuls les éléments spécifiques déposés le sont (anneaux olympiques, logo officiel, typographie propriétaire). La règle pratique : s'inspirer librement d'un univers visuel, ne jamais reproduire ni nommer un élément enregistré.

### PUE

**Power Usage Effectiveness.** Rapport entre l'énergie totale consommée par un datacenter et l'énergie effectivement utilisée par les serveurs. Un PUE de 1,2 (AWS eu-west-1) signifie que 20 % de l'énergie est perdue en refroidissement et infrastructure. Multiplie la consommation serveur dans le calcul SCI. Voir [docs/sci.md](./sci.md) B3.

### SCI

**Software Carbon Intensity.** Indicateur de l'empreinte carbone d'un logiciel par unité fonctionnelle, défini par la Green Software Foundation (ISO/IEC 21031:2024). Formule : `SCI = (E × I + M) / R`, où E = énergie (kWh), I = intensité carbone (gCO₂e/kWh), M = [embodied](#embodied), R = [unité fonctionnelle](#unité-fonctionnelle). Dans AirPair : gCO₂e par partie jouée. Voir [docs/sci.md](./sci.md), [D17](./decisions.md).

### Semver

**Semantic Versioning.** Convention de numérotation de versions `MAJOR.MINOR.PATCH`. Dans AirPair : MAJOR correspond à la phase (0, 1, 2, 3) ; MINOR marque une fin de phase ou une feature significative ; PATCH couvre les correctifs dans la phase. Version actuelle : `0.2.x` (phase 1 MVP). Voir [CLAUDE.md](../CLAUDE.md).

### Trunk-based development

Stratégie de gestion des branches git : tout le développement se fait sur des branches courtes qui mergent fréquemment sur `main` (le trunk). Pas de branches longues vivant plusieurs semaines. Dans AirPair : branches nommées `feat/`, `fix/`, `chore/`, mergées via PR, jamais de commit direct sur `main`. Voir [CLAUDE.md](../CLAUDE.md).

### Unité fonctionnelle

**R dans la formule [SCI](#sci).** Unité de mesure par rapport à laquelle le score est normalisé — définit CE QUE fait le logiciel. Dans AirPair : une partie jouée (match à 7 points, marge 2, 2 joueurs, durée typique 2-4 min). Le choix de l'unité fonctionnelle est structurant : il détermine ce qu'on optimise et ce qu'on compare entre versions. Voir [docs/sci.md](./sci.md).
