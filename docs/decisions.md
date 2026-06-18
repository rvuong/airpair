# AirPair — Journal de décisions

Format : pour chaque sujet → contexte, options envisagées, décision,
justification, implications. Ce fichier capture le POURQUOI des choix, y
compris les alternatives écartées. Il s'amende (on met à jour le statut d'une
décision), il ne se réécrit pas en récit.

Statuts : ✅ acté · 🔬 à valider par prototype/playtest · ⏸ reporté · ❌ écarté

---

## D01 — Localisation spatiale des téléphones ✅

**Contexte.** L'idée initiale prévoyait de localiser les deux téléphones dans
l'espace (QR code imprimé posé sur la table + caméra, gyroscope, voire UWB)
pour créer l'illusion de la balle qui passe d'un écran à l'autre.

**Options envisagées.** (a) QR papier + caméra ; (b) UWB/Bluetooth ranging ;
(c) aucune localisation, orientation par convention.

**Décision : (c) — aucune localisation spatiale.**

**Pourquoi.** L'illusion n'exige que trois choses : un état de jeu partagé, une
horloge partagée, et une orientation relative connue. Or l'orientation peut
être décrétée par convention : chaque joueur tient son téléphone face à lui,
le haut de mon écran pointe vers l'adversaire ; la balle qui sort en haut chez
moi entre en haut chez lui, coordonnée horizontale inversée en miroir. La
distance physique n'a pas besoin d'être mesurée : elle est décrétée via la
durée de traversée de la zone morte. Économie estimée : ~60 % de la complexité
du projet.

**Implications.** La "zone morte" entre les écrans (~400 ms de traversée,
fonction de la vitesse) devient un élément de design : tension, anticipation,
et tampon qui absorbe la latence réseau.

---

## D02 — Garantie du face-à-face physique ✅

**Contexte.** Sans localisation (D01), qu'est-ce qui empêche de jouer à
distance ? Le jeu à distance n'est pas l'idée forte du concept.

**Options envisagées.** (a) vérification technique de proximité (réseau
commun, ultrason, etc.) ; (b) rien de technique, garantie par le flux
d'appairage + le design.

**Décision : (b).**

**Pourquoi.** L'appairage retenu (QR affiché sur l'écran de A, scanné par la
caméra de B) prouve la coprésence au démarrage : on ne scanne pas un écran à
distance. Ensuite, le design fait la police : sans le son physique du
téléphone adverse, sans le corps de l'adversaire, le jeu à distance est une
expérience dégradée qui se dissuade elle-même. Ne pas dépenser d'énergie à
l'empêcher.

**Implications.** Garde-fous légers possibles en phase 3 si besoin : QR
expirant en 30 s, comparaison des IP publiques côté serveur. Non prioritaire.

---

## D03 — Mode de contrôle de la raquette ✅🔬

**Contexte.** Idée initiale : faire "slider" le téléphone latéralement
(translation). Problème physique fondamental : ni gyroscope ni accéléromètre
ne mesurent une translation. Le gyroscope mesure la rotation ; l'accéléromètre
exige une double intégration qui dérive massivement en quelques secondes
(problème classique non résolu sans repère externe).

**Options envisagées.** (a) translation via accéléromètre filtré (type souris,
impulsions + amortissement) ; (b) inclinaison/tilt (mesure d'orientation
absolue, stable) ; (c) toucher (glisser le doigt) ; (d) téléphone posé à plat
sur la table, glissé comme un palet de air hockey.

**Décision : (b) tilt, téléphone en main, portrait.** (c) conservé comme
fallback debug. (a) et (d) écartés.

**Pourquoi.** Le tilt est fiable, précis, éprouvé (capteur d'orientation =
mesure absolue, pas de dérive). La translation (a) reste imprécise et
dérivante. L'option à plat (d) cumule les défauts : annule le tilt, ressuscite
la dérive de translation, et baisse les yeux vers la table au lieu de
l'adversaire. La légère exigence physique du tilt (tenue, micro-mouvements)
est assumée comme une qualité, "comme dans un sport".

**À valider (proto 0a).** Le tilt est-il fun et précis en 30 s de prise en
main pour 3 personnes sur 4 ? Sinon : pivot tactile ou arrêt — c'est le pari
central du projet. Point critique de tuning : le calibrage du neutre (la tenue
"confortable" varie selon les joueurs) + re-centrage avant chaque manche.

**Amendement (9 juin 2026, post-playtest #2) :** tilt perçu comme imprécis.
Ajustements actés (PR fix/ball-size-tilt-precision) :
- `amplitude` : 20° → 15° (plage complète accessible sans incliner trop fort)
- `exponent` : 1.4 → 1.1 (quasi-linéaire, réponse plus prédictible)
- `alpha` : 0.3 → 0.45 (moins de lissage, lag réduit ~80 ms → ~40 ms)
Déadzone inchangée (1,5°).

---

## D04 — Architecture réseau et synchronisation ✅

**Contexte.** La balle doit sembler quitter un écran et arriver sur l'autre au
bon moment. Idées initiales : AirDrop, time-based token, etc.

**Options envisagées.** (a) streaming continu de l'état (position de balle
60×/s) ; (b) simulation déterministe locale + échange d'événements de frappe ;
(c) AirDrop (écarté d'emblée : transfert de fichiers, pas un canal temps réel,
non exposé aux apps tierces pour cet usage).

**Décision : (b).**

**Pourquoi.** Pong est déterministe : la trajectoire est entièrement
calculable depuis une frappe. Chaque client simule localement ; à chaque
frappe, un seul message `{t_frappe, position, vecteur_vitesse, (effet)}` ;
l'adversaire calcule lui-même la traversée et l'instant d'apparition. Entre
deux frappes : zéro trafic. La synchro d'horloge se fait au démarrage par
handshake ping/pong type NTP simplifié (~10 itérations, médiane de l'offset ;
latence = RTT/2). Cible : offset < 20 ms en WiFi local, < 50 ms en 4G. La zone
morte de ~400 ms rend une latence réseau de 30-100 ms totalement invisible.

**Implications.** Autorité distribuée : le téléphone du camp où est la balle
décide seul "frappée/ratée" puis notifie l'autre. Pas d'arbitre central, pas
d'anti-triche nécessaire à 2 joueurs.

---

## D05 — Transport réseau et appairage ✅

**Options envisagées.** (a) WebRTC DataChannel P2P (latence quasi nulle en
local, mais signalisation + TURN à gérer) ; (b) WebSocket via petit serveur
relais (30-80 ms via Internet, trivial à implémenter) ; (c) natif Nearby
Connections / MultipeerConnectivity (local sans Internet, mais cross-platform
pénible).

**Décision : (b) pour le MVP — l'option la plus simple, assumée.** Escalade
vers (a) en phase 2 uniquement si la latence du relais gêne (peu probable
grâce à la zone morte).

**Appairage de session :** le joueur A crée une partie, son téléphone affiche
un QR contenant l'ID de room, B le scanne. Fallback : code court à taper.
Réutilise l'intuition QR de l'idée initiale, au bon endroit (écran, pas
papier).

**Rituel de démarrage :** calibrage du tilt PUIS compte à rebours "3, 2, 1"
synchronisé sur les deux écrans (matérialise le duel + vérifie visiblement la
synchro d'horloge).

---

## D06 — Affichage de la moitié adverse ✅🔬

**Contexte.** Chaque joueur ne voit que sa moitié. Faut-il un pointeur
indiquant la position de la balle quand elle est chez l'adversaire ?
(Techniquement gratuit grâce à D04 : la simulation locale connaît la position
de la balle partout.)

**Options envisagées.** (a) pointeur permanent en haut d'écran ; (b) rien
pendant la phase adverse, + indicateur d'approche quand la balle revient vers
moi (ombre/point grandissant sur le futur point d'entrée).

**Décision : (b).** Pointeur permanent écarté (pour l'instant).

**Pourquoi.** Le pointeur rive les yeux à l'écran et tue les deux moments
forts : la tension de l'invisible et le regard porté sur l'adversaire réel.
L'indicateur d'approche donne l'information d'équité ("je pouvais savoir") —
équivalent de voir la balle en l'air au ping-pong — sans révéler le jeu
adverse.

**À valider (phase 2).** Garder les deux variantes derrière un toggle et
trancher en playtest. Le ✅ vaut pour la décision de base (indicateur
d'approche déployé en MVP) ; le 🔬 vaut pour la comparaison toggle — aucun
playtest dédié n'a encore été conduit.

**🔬 En question (15 juin 2026, post-playtest #4) :** indicateur perçu comme
trop tardif ("voir d'où arrive la balle sans délai"). Piste : avancer
l'apparition de l'indicateur dès l'entrée en zone morte (vs seulement dans
les dernières ms). Voir [`docs/playtests/playtest-4-work.md`](./playtests/playtest-4-work.md) item 5.

**Trajectoire de prédiction (15 juin 2026) : ❌ écarté sur le principe.**
Le feedback "voir la trajectoire" peut désigner deux choses. La *traînée*
(positions passées) est du juice neutre — elle renforce la physicalité de la
balle. La *ligne de prédiction* (positions futures) est une contradiction
directe avec cette décision et avec le moment magique : elle résout à l'avance
ce que la traversée invisible est censée laisser dans l'incertitude. La charge
de la preuve est inversée — il faudrait un playtest démontrant un bénéfice
clair pour rouvrir la question. Voir [`docs/playtests/playtest-4-work.md`](./playtests/playtest-4-work.md) item 8.

---

## D07 — Silhouette de l'adversaire ❌

**Décision : abandonnée définitivement.** L'adversaire réel est à un mètre ;
une silhouette numérique serait redondante, coûteuse (aucune donnée de
tracking disponible), et pousserait vers une expérience "à distance" contraire
à l'intention. La lecture du corps adverse n'est pas une feature : c'est une
propriété émergente du dispositif physique.

---

## D08 — Audio ✅ / replay du son adverse ⏸

**Décision.** L'audio est le canal de feedback principal (la balle est
invisible en transit ; la vibration n'est pas fiable cross-platform, cf. D09).
Sons MVP : frappe percussive avec attaque franche (type "pock" de ping-pong,
qui porte à volume modéré), point marqué, compte à rebours.

**Son de frappe adverse : rien à développer.** Quand l'adversaire frappe, son
téléphone joue le son pour lui ; à un mètre, je l'entends naturellement.
Propriété émergente de la coprésence.

**Reporté en phase 2 :** replay atténué de la frappe adverse sur mon téléphone
(l'instant exact est connu via l'événement réseau) pour les environnements
bruyants (bar). Toggle de playtest, pas du MVP.

**Pièges iOS :** AudioContext à débloquer sur geste utilisateur ; le bouton
silencieux physique de l'iPhone coupe le Web Audio → avertir l'utilisateur.

---

## D09 — Haptique (vibrations) ⏸

**Décision : hors scope v1.** État vérifié (juin 2026) : `navigator.vibrate`
fonctionne sur Chrome/Edge/Samsung Internet Android, mais Safari iOS ne l'a
jamais implémenté et Firefox l'a retiré (v129+). Il existe un hack iOS 18 via
l'élément switch HTML (lib use-haptic) — fragile. Conclusion : aucune
information de jeu ne doit dépendre de la vibration ; à réintroduire plus tard
en progressive enhancement (Android d'abord).

---

## D10 — Stack technique ✅

**Options envisagées.** (a) PWA TypeScript + Canvas 2D ; (b) WASM/Rust ;
(c) moteur de jeu (Phaser…) ; (d) natif iOS/Android.

**Décision : (a).** Vite + TypeScript, Canvas 2D, PWA, sans moteur ni WASM.

**Pourquoi.** Le jeu est computationnellement trivial (une balle, deux
raquettes, trigo simple à 60 fps). WASM ne résout aucun problème présent et
ajoute tooling + frontière JS↔WASM, alors que TOUTES les API critiques sont
côté JS : DeviceOrientationEvent, Web Audio, WebSocket, caméra/QR. Un moteur
est superflu pour un Pong. Le natif est écarté pour raisons pragmatiques
(coût d'entrée iOS) — réévaluable si tous les prérequis se lèvent à moindre
coût.

**Serveur (phase 1) :** Node + `ws`, ~100 lignes (rooms, relais, handshake
horloge).

---

## D11 — Hébergement ✅

**Options envisagées.** (a) GitHub Pages ; (b) AWS S3 (+ CloudFront) ;
(c) tier gratuit Render/Fly.io/Railway pour le serveur WS ; (d) EC2 AWS.

**Décision.** Client statique : **GitHub Pages** (gratuit, HTTPS natif —
indispensable pour capteurs et caméra, déploiement par push). Serveur WS :
**EC2 t4g.nano AWS eu-west-1** (compte AWS existant, ~4 €/mois, isolation
totale de la prod odomate, Elastic IP stable).

**Pourquoi EC2 plutôt que tier gratuit.** Fly.io a supprimé son free tier en
2024 pour les nouveaux comptes (2h d'essai seulement). Les alternatives
gratuites (Render, Railway) ont soit un sleep après inactivité, soit une
durée d'essai limitée. EC2 t4g.nano à ~3,40 $/mois sur un compte déjà
facturé est plus simple, stable, et centralisé. Pas de load balancer
(coût fixe +16 $/mois injustifié) : Nginx + Let's Encrypt directement sur
l'instance. URL : `wss://ws.odomate.eu` (sous-domaine de la zone Route 53
odomate.eu existante, zéro coût supplémentaire). CI/CD : workflow GitHub
Actions `deploy-server.yml` — SSH + git pull + tsc + pm2 reload.

**Dev local :** Vite en HTTPS sur réseau local (`@vitejs/plugin-basic-ssl`),
certificat à accepter sur l'iPhone — itération sans déploiement.

**SCI (B3) :** t4g.nano ARM Graviton2 — TDP attribué estimé ~5 W (prorata vCPU),
PUE AWS ≤ 1,2, grille eu-west-1 (Irlande) ~200 gCO₂e/kWh. Facteurs versionnés
dans [`sci/factors.yaml`](../sci/factors.yaml) (`server`).

---

## D12 — Cible de test et pièges iOS ✅

**Contexte.** Appareil de test : iPhone 11 (Safari). Concentre tous les pièges
iOS — à intégrer dès le proto 0a, sinon heures perdues.

Checklist : `DeviceOrientationEvent.requestPermission()` dans un handler de
geste utilisateur (HTTPS requis) · déblocage AudioContext dans ce même geste ·
`touch-action: none` + `overscroll-behavior: none` + preventDefault touchmove
(anti pull-to-refresh) · Wake Lock pour la mise en veille · pas de
verrouillage d'orientation web sur iOS → assumer portrait + écran "tournez
votre téléphone" · vibration non supportée (D09).

**Piège PWA standalone — canvas overflow (découvert playtest juin 2026) :** en mode
standalone (icône écran d'accueil), `window.innerHeight` = hauteur d'écran complète
(safe areas incluses), contrairement à Safari browser où la toolbar réduit cette
valeur. Si le canvas `display:block` est placé dans un conteneur flex avec
`padding-bottom: env(safe-area-inset-bottom)` + `overflow-y: hidden`, le bas du
canvas (raquette) est rogné — le joueur ne voit plus sa raquette. **Correction :
`position:fixed; top:0; left:0` sur le canvas** — il sort du flux flex, les
dimensions `window.innerWidth/innerHeight` s'alignent avec le viewport réel, et
aucun parent ne peut rogner son contenu.

**Proto 0b à un seul iPhone :** second client = navigateur desktop
clavier/souris, suffisant pour valider la synchro. Test à deux vrais
téléphones (emprunter un Android = validation cross-platform) en phase 1.

**Playtests Android — priorité phase 2.** Les playtests 1-3 (juin 2026) ont
tous été conduits sur iPhone uniquement. Recruter au moins un joueur Android
(Chrome) pour valider : sensors API, AudioContext, tilt cross-platform, rendu
Canvas. Chrome Android diffère d'iOS Safari sur les permissions capteurs (pas
de `requestPermission()` nécessaire) et sur l'haptique (D09).

---

## D13 — Règles du jeu ✅ (amendé après premier playtest)

**MVP initial :** 11 points, marge 2, service alterné tous les 2 points,
vitesse de balle croissante à chaque échange.

**Amendement (9 juin 2026, post-premier playtest) :** jeu trop lent et trop
long en conditions réelles. Ajustements actés :
- Score : **7 points**, marge 2 inchangée (8-6, 9-7, 12-10 possibles).
- Vitesse initiale de service : **0.60 × H/s** (vs 0.45 — équivaut à la
  vitesse du 3e échange avant).
- Accélération par frappe : **×1.10** (vs ×1.06 — plafond atteint plus vite,
  échanges tendus rapidement).
- **Escalade du service :** la vitesse de départ de chaque nouveau service
  augmente de +10 % par rapport au précédent (plafonné à MAX_SPEED_NORM).
  Effet : la partie s'emballe progressivement dès le service, pas seulement
  pendant l'échange. Remise à 0.60 à chaque revanche.
- **Affichage pré-partie :** "Premier à 7 points · marge de 2" visible avant
  le lancement — le joueur sait où il va.

**Amendement 2 (12 juin 2026, post-playtest iPhone) :** balle trop lente au
service (~3 s pour traverser l'écran sur iPhone 13). Ajustements actés :
- Vitesse initiale : **1.20 × H/s** (doublée vs 0.60).
- Plafond : **2.20 × H/s** (doublé pour préserver la marge d'accélération).
- Courbe de croissance : **logarithmique (lerp factor 0.20)** — chaque frappe
  rapproche la vitesse du plafond par `v += (MAX - v) × 0.20`. Remplace la
  croissance géométrique ×1.10 : les premières frappes accélèrent davantage,
  puis les gains diminuent à l'approche du plafond (sensation naturelle).
- Même logique pour l'escalade du service point par point.

**Amendement 3 (17 juin 2026) :** vitesse 1.20 × H/s confirmée OK après tests
récents. La piste de réduction à 0.80-0.90 (playtest #4) est close — voir
[`docs/playtests/playtest-4-work.md`](./playtests/playtest-4-work.md) item 2.

---

## D14 — Effets de balle ⏸ (phase 3)

Coup de poignet sec à la frappe = effet lifté/coupé courbant la trajectoire.
Le gyroscope détecte très bien ce geste (rotation = son point fort, contraste
avec D03). Explicitement hors MVP.

---

## D15 — Nom du projet ✅

**Décision : AirPair** (acté le 10 juin 2026).

**Pourquoi AirPair.** Trois lectures simultanées sans explication nécessaire :
- **Air** : la traversée invisible entre les deux écrans — le moment magique
  central du concept (D01, D06). Ancrage dans le registre tennis (balle dans
  l'air, face à face) plutôt que tennis de table (surface, espace contraint).
- **Pair** : deux joueurs + le geste d'entrée dans le jeu (appairage QR, D05).
- **AirPair** ensemble : rime intérieure légère, 7 lettres, fonctionne en FR
  et EN, aucun risque IP identifié.

**Alternatives écartées.** Pong Bros. (nom de travail — "PONG" marque Atari,
"Bros." évoque Nintendo) ; PingBros, PongPals, Bounce Bros, Face2Ball (trop
génériques ou mêmes risques IP) ; AirRally, Plink (finalistes — bons noms,
mais AirPair nomme simultanément plus de dimensions du concept).

**Vérifications à faire avant publication store.**
1. Marque classe 41 EUIPO + USPTO (divertissement, jeux).
2. Conflits sur App Store / Google Play.
3. Disponibilité domaine (`airpair.app` ou `.io`).

**Prochaine étape : identité visuelle AirPair** — logo, palette, typographie,
icône PWA. À traiter avant toute diffusion publique (LinkedIn, GitHub public).

---

## D16 — Documentation du projet ✅

[`PROJECT.md`](../PROJECT.md) = état courant, court (< 200 lignes), contexte d'entrée pour
Claude Code. `docs/decisions.md` (ce fichier) = le pourquoi, par sujet, amendé
au fil des décisions — préféré à une synthèse narrative de conversation, qui
vieillit mal et mélange décisions actées et supersédées. Specs détaillées dans
`docs/*.md` au fil de l'eau.

---

## D17 — Démarche d'ingénierie responsable (SCI) ✅

**Contexte.** Volonté de mesurer le coût environnemental de la réalisation et
de l'exploitation, avec un rapport global et une boucle d'amélioration.
Référentiel : Software Carbon Intensity (GSF, ISO/IEC 21031:2024).

**Décisions de cadrage.** (1) Deux volets : coût de réalisation = total
ponctuel en kgCO₂e (le SCI ne couvre pas le dev), SCI d'exploitation = taux ;
lien par amortissement du total sur les parties cumulées. (2) Unité
fonctionnelle R = une partie jouée. (3) Facteurs d'émission figés et
versionnés ([`sci/factors.yaml`](../sci/factors.yaml)) : la valeur est dans la comparaison relative
entre versions, pas dans le chiffre absolu. (4) Chaque chiffre étiqueté
[mesuré] ou [estimé]. (5) Pas de télémétrie intrusive : compteurs agrégés
côté serveur uniquement.

**Pourquoi.** L'architecture est déjà sobre by design (D04 : zéro streaming,
quelques Ko par partie ; D10 : PWA légère sans framework). Le poste dominant
attendu est l'embodied des smartphones (M) → levier d'écoconception n°1 :
compatibilité avec les appareils anciens (le jeu ne doit pousser personne à
changer de téléphone).

**Implications.** Worklog + wattmètre dès la phase 0 ; baseline SCI complète
en fin de phase 1 ; budgets CI immédiats (bundle ≤ 150 Ko gzip, ≤ 20 Ko par
partie, EcoIndex A) ; manifest Impact Framework versionné ; rapport par
release dans [`sci/reports/`](../sci/reports/). Usage IA (Claude Code) inclus dans le volet
réalisation, rapporté en fourchette (forte incertitude). Détail complet :
[`docs/sci.md`](./sci.md).

**Amendement — Précision volet réalisation : mesure de l'usage IA.** La
réalisation (conception comprise) EST mesurée — volet A de [docs/sci.md](./sci.md) —
mais rapportée en total (kgCO₂e), distinct du taux SCI d'exploitation, avec
pont par amortissement sur les parties cumulées. Protocole tokens précisé :
Claude Code compté exhaustivement via ccusage (logs locaux, export hebdo dans
sci/ai-usage/) ; sessions de conception claude.ai estimées manuellement au
worklog ; conversion CO₂e en fourchette basse/haute (aucun facteur officiel
par token, ~1 ordre de grandeur d'incertitude, sources dans factors.yaml).

---

## D18 — Documentation publique : série LinkedIn ✅

**Contexte.** Volonté de documenter la démarche globale de réalisation sous
forme d'épisodes (posts/articles LinkedIn).

**Décision.** Série "journal de bord" dont la matière première est
`docs/decisions.md` (1 épisode = 1 décision ou 1 résultat + 1 leçon
transférable). Brouillons rédigés à chaud à chaque jalon, publiés après relecture à froid.
Cadence calée sur l'avancement réel.

**Pourquoi.** Le journal de décisions a déjà la structure narrative d'un bon
post (problème → options → arbitrage → leçon) : coût marginal de rédaction
faible, et la discipline de documentation sert les deux usages (contexte IA
et communication).

**Implications.** Honnêteté radicale (impasses et chiffres décevants
publiés) ; les chiffres SCI publiés respectent docs/sci.md (fourchettes,
étiquettes [mesuré]/[estimé]) ; le temps de rédaction entre au worklog SCI ;
garde-fou : ne jamais arbitrer une décision projet pour "faire un meilleur
post".

---

## D19 — Revanche et alternance du premier service ✅

**Contexte.** En fin de partie, l'expérience naturelle du ping-pong est de
rejouer immédiatement. Sans bouton revanche, les joueurs doivent recharger
la page et re-appairer — friction qui tue l'envie spontanée de rematch.

**Décision.** Bouton "Revanche" en fin de partie. Le premier service change
de joueur à chaque partie : si A a servi en premier, B sert en premier à la
revanche — équité perçue sans règle à expliquer.

**Pourquoi.** L'alternance est implicite (comme au tennis de table) ; le
joueur qui vient de perdre a "la balle" psychologiquement. La mise en œuvre
est triviale (bit `firstServer` qui flip). L'absence de relance facile était
le principal frein au critère go/no-go "redemander une revanche".

---

## D20 — Taille de la balle ✅

**Contexte.** Playtest #2 (9 juin 2026) : la balle est jugée trop petite à la
valeur initiale `BALL_RADIUS_NORM = 0.013` (~10 px de diamètre sur iPhone 11).

**Options envisagées.** (a) 10 px (initial) ; (b) 15 px (×1.5, valeur
"raisonnable") ; (c) 25 px (×2.5, exagération délibérée pour trouver la
limite haute).

**Playtest #2 :** test (c) 25 px → trop grande. Réduit à 20 px (−5 px,
`BALL_RADIUS_NORM = 0.0267`) en playtest #3.

**Décision actée (19 juin 2026, post-playtests) :** 20 px (`BALL_RADIUS_NORM = 0.0267`) validé.

---

## D21 — Accessibilité malvoyance 🔬

**Contexte.** Playtest #3 (9 juin 2026) : libellés illisibles à l'usage réel
("Deux joueurs, un seul écran partagé", "← Retour", "En attente joueur B…",
textes Canvas en jeu). Question posée : quelle norme d'accessibilité visuelle
intégrer, dans quelles contraintes ?

**Contraintes du projet qui bornent le périmètre.**
- Canvas 2D pour le jeu : pas de DOM → ARIA, focus, navigation clavier, et
  reflow (WCAG 1.4.10) sont inapplicables dans la zone de jeu.
- `user-scalable=no` dans le viewport (délibéré : anti-scroll, anti-zoom
  qui casserait le jeu) → bloque WCAG 1.4.4 (Resize Text) ; la mitigation
  est de garantir que les textes sont lisibles sans zoom.
- Bundle ≤ 150 Ko gzip (pas de lib d'a11y lourde).
- Cible principale : iPhone 11 Safari (375 px CSS, écran ~6" à bras tendu).

**Critères WCAG 2.1 qui s'appliquent à Canvas (images of text = même règle
que texte HTML) :**
- **SC 1.4.3 AA** — Contraste minimum : ≥ 4,5:1 (texte normal < 24 px, ou
  gras < 18,5 px) ; ≥ 3:1 (grand texte ≥ 24 px, ou gras ≥ 18,5 px).
- **SC 1.4.6 AAA** — Contraste renforcé : 7:1 / 4,5:1 (aspirationnel).
- **SC 1.4.11 AA** — Contraste non-textuel : ≥ 3:1 pour raquette/balle si
  c'est le seul moyen d'identifier l'état de jeu.
- **SC 1.4.1 A** — Ne jamais utiliser la couleur seule pour transmettre un
  état de jeu (ex. balle rouge = faute : ajouter forme/position/son).
- **Touch targets ≥ 44×44 px** (Apple HIG, WCAG 2.5.5 AAA, GAG Basic) —
  s'applique aux overlays DOM (boutons pre-game, Revanche, Retour Canvas).
- **Police HUD ≥ 24 px** (Game Accessibility Guidelines, niveau Basic).

**Critères inapplicables (Canvas + `user-scalable=no` assumé) :**
ARIA, keyboard nav (2.1.x), focus management (2.4.x), reflow (1.4.10),
Name/Role/Value (4.1.2), non-text alt (1.1.1).

**Plan d'intégration par phase.**

*Immédiat (ce PR).* Tous les textes petits doublés en test (× 2 — voir
D20). Objectif cible ≥ 24 px pour tout texte HUD Canvas et label DOM.

*Phase 2.* Audit des ratios de contraste effectifs : textes blanc
semi-transparent (rgba 0.4–0.55) sur fond jeu sombre → mesurer avec un
outil (APCA ou WCAG ratio). Corriger si < 3:1 sur fond le plus clair
possible (balle lumineuse en approche). Vérifier taille tactile des boutons
Canvas (Revanche, Retour) : hitbox ≥ 44×44 px.

*Phase 3 (Advanced GAG).* Toggle taille de texte in-game : seul substitut
réaliste à Dynamic Type iOS pour un Canvas PWA. Non prioritaire avant
validation du fun.

**Sources.** WCAG 2.1 SC 1.4.3/1.4.6/1.4.11/1.4.1 (w3.org) ·
Game Accessibility Guidelines full list (gameaccessibilityguidelines.com) ·
IGDA GASIG Visual (igda-gasig.org) · APCA in a Nutshell (apcacontrast.com).

---

## D22 — Thèmes visuels ⏸ (phase 3)

**Contexte.** Retour playtest (10 juin 2026) : graphismes austères. Décision :
ne pas toucher à l'esthétique de base (elle fonctionne), mais prévoir un
système de thèmes pour ajouter de la personnalité et de la proximité entre
les joueurs.

**Principe.** L'hébergeur choisit un thème au moment de créer la partie ;
le joueur qui rejoint reçoit automatiquement le même thème. Cohérence visuelle
du terrain = renforcement de la sensation de terrain partagé.

**Thèmes envisagés (liste ouverte) :**
| Thème | Fond | Bandes | Balle | Notes |
|---|---|---|---|---|
| Synthétique (défaut) | Bleu dur | Blanches | Jaune | Actuel épuré |
| Terre battue | Ocre (type Roland Garros) | Blanches | Jaune | Texture granuleuse optionnelle |
| Gazon | Vert | Blanches | Jaune | Bandes de tonte en alternance |
| JO Paris 2024 | Charte JO 2024 (violet/rose/bleu) | Selon charte | Jaune | Droits à vérifier pour usage public |

**Ce qu'un thème couvre :** couleur de fond, couleur des bandes/lignes,
couleur de la balle, couleur de la raquette. Pas de texture haute résolution
(contrainte bundle ≤ 150 Ko).

**Ce qu'un thème ne couvre pas (pour l'instant) :** sons, typographie,
animations.

**Implémentation envisagée :** objet `Theme` passé à l'écran de jeu, choix
stocké dans la room côté serveur et relayé au joueur B au moment du `game_start`.
Le thème "Synthétique" (actuel) reste le défaut.

**Note (15 juin 2026) :** le feedback playtest #4 demande une "table". Avant
d'implémenter quoi que ce soit : AirPair c'est la balle dans *l'air* entre
deux écrans (D01, D15), pas sur une surface. Une texture de table contredit
l'intention. Si le problème est un "manque de repère de terrain", la bonne
réponse est des *lignes de terrain* (ce que ce thème prévoit déjà) — pas une
surface plane. Voir [`docs/playtests/playtest-4-work.md`](./playtests/playtest-4-work.md) item 4.

**Statut : roadmap phase 3 — aucune implémentation avant validation du fun
(critère go/no-go phase 2).**

---

## D23 — Musique de fond 8-bit ⏸ (phase 3, conditionnel)

**Contexte.** Retour playtest (10 juin 2026) : "pas de son". Idée proposée :
musique de fond type chiptune 8-bit, inspiration jeux Atari/arcade années 80.

**Question préalable à trancher.** "Pas de son" peut désigner deux problèmes
différents : (a) les sons de jeu (frappe, rebond, point) n'ont pas été
entendus — bug AudioContext iOS, bouton silence, volume trop bas ; (b) il
manque vraiment une musique d'ambiance. La réponse oriente complètement la
solution. **À investiguer en priorité lors du prochain playtest.**

**Tension avec D08.** L'audio est le canal de feedback principal : les sons
de frappe sont de l'information de jeu, pas de l'habillage. Une musique de
fond peut les masquer, en particulier dans les environnements bruyants.
Règle impérative si implémenté : hiérarchie audio stricte (sons de jeu
toujours en premier plan, musique clairement en dessous) + toggle
activation/désactivation.

**Ce qui plaide pour.**
- Cohérence stylistique évidente : Pong est né sur Atari en 1972, le
  chiptune est dans son ADN.
- Coût technique quasi nul : synthèse procédurale via WebAudio oscillators =
  zéro octet de bundle, zéro dépendance.
- Compense l'austérité visuelle (D22) par une couche sensorielle.
- Peut renforcer la synchronisation émotionnelle entre les deux joueurs.

**Ce qui plaide contre.**
- Boucle répétitive sur 5-10 min : risque d'irritation rapide.
- Contexte social en face-à-face : la musique couvre la communication
  verbale et brise le naturel de l'interaction.
- Le silence du bouton iOS (D08) devient encore plus saillant et gênant
  quand il y a une musique attendue.
- Complexité de mix : calibrer les volumes relatifs (musique + FX) sur
  tous les appareils est du travail non trivial.

**Options d'implémentation (pour mémoire, pas de spec).**
- Synthèse WebAudio temps réel (oscillateurs carrés/triangle, séquenceur
  minimal) : bundle 0 Ko, effort moyen, rendu authentiquement 8-bit.
- Fichier audio court OGG en boucle (~20-30 Ko gzip) : effort faible,
  dépend d'une composition.
- Génération algorithmique (lib type `jsfxr`, `ZzFX`) : bundle ~2 Ko,
  sons procéduraux à chaque partie.

**Statut : ⏸ phase 3, et conditionnel.** Ne pas implémenter avant :
1. Confirmation que les sons de jeu existants sont bien entendus (sinon
   corriger D08 d'abord).
2. Go/no-go phase 2 (critère "revanche spontanée").
3. Toggle obligatoire (off par défaut ou on par défaut à valider en
   playtest).

---

## D24 — Identité visuelle AirPair ✅

**Contexte.** Le nom AirPair est acté (D15). Avant toute diffusion publique
(LinkedIn, GitHub public, store), une identité visuelle cohérente est
nécessaire : logo, icône PWA, palette, typographie.

**Périmètre : UI uniquement.** L'identité s'applique aux écrans DOM (démarrage,
appairage, fin de partie, README, LinkedIn). Le terrain de jeu (Canvas) n'est
pas concerné — il relève de D22 (thèmes visuels, phase 3).

**Contraintes non négociables.**
- Bundle ≤ 150 Ko gzip — pas d'image lourde.
- PWA : icône 512×512 + 192×192 (PNG), maskable, fond plein (pas de
  transparence pour les stores Android).
- Contraste ≥ 4,5:1 sur tout texte UI (D21).

**Décisions actées (10 juin 2026).**

*Logo : vectoriel + typographique.* SVG inline ou fichier `.svg` — zéro coût
bundle, scalable à toutes tailles (favicon 16px → bannière LinkedIn). Le logo
combine une marque iconique (vecto) et le nom "AirPair" composé. Variante
icône seule (carré) pour PWA et favicon.
Symbolique : le passage de balle dans l'air entre deux positions face à face —
deux raquettes en miroir, trajectoire/arc central, ou deux demi-formes
symétriques. À préciser en production.

*Palette : indépendante, registre rétro 8-bit.* Palette propre à AirPair,
sans héritage du bleu Synthétique (D22). Inspiration couleurs d'écrans CRT
et cartouches des années 80 : noir profond ou bleu très sombre en fond,
accents cyan, magenta, vert phosphore ou jaune arcade — vifs, saturés, mais
pas criards. Deux ou trois couleurs max (cohérence icône PWA sur fond plein).

*Typographie : font système.* `system-ui` / `-apple-system` / `Roboto` selon
l'OS — zéro bundle, rendu natif optimal. Cohérent avec D10 (pas de dépendance
superflue). Le logo peut incorporer une typo vectorisée (chemin SVG) sans
charger de font runtime.

**Identité complète (10 juin 2026).** SVG procédural pur, sans outil externe.

*Fichiers produits :*
- `src/assets/icon.svg` (100×100, carré) · `src/assets/logo.svg` (300×80, icône + wordmark)
- `src/public/favicon.svg` — favicon SVG, câblé dans `index.html`
- `src/public/icon-192.png` · `src/public/icon-512-maskable.png` — générés via `scripts/gen-icons.html`
- `src/public/apple-touch-icon.png` (192px) — iOS "Add to Home Screen"
- `src/public/manifest.webmanifest` — icônes SVG + PNG déclarées, `display: standalone`

*Dans `index.html` :* `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<link rel="manifest">`, `<meta name="theme-color" content="#080818">`.

*Landing screen :* logo SVG inline remplace le `<h1>AirPair</h1>` texte brut.

Installation PWA fonctionnelle sur iOS (apple-touch-icon) et Android Chrome (manifest PNG maskable).

---

## Questions ouvertes (à trancher par prototype/playtest)

> Ajouts post-playtest #4 (15 juin 2026) — voir analyse complète dans
> [`docs/playtests/playtest-4-work.md`](./playtests/playtest-4-work.md).

12. **Onboarding règles.** Aucune explication du contrôle ou des règles à
    l'entrée en partie. Option : texte contextuel sur l'écran de calibrage
    ("Inclinez pour bouger la raquette — premier à 7 points") + écran règles
    optionnel. Quelle information minimale suffit ?
13. **Lisibilité raquettes.** Couleur et contraste des raquettes insuffisants.
    À vérifier et corriger indépendamment de D22 (thèmes phase 3).
14. **Couleurs Canvas.** Palette D24 s'applique aux écrans DOM mais pas au
    Canvas. Appliquer la palette AirPair au rendu de jeu (balle jaune, raquette
    cyan, fond bleu sombre, lignes blanches) sans créer le système de thèmes
    D22 — quick win qui anticipe le thème Synthétique.
15. **Effet visuel de rebond.** Squash/stretch de la balle à l'impact (3-4
    frames). Distinct de D14 (effets de trajectoire au gyroscope). Coût faible,
    impact "juice" significatif.
16. **Trajectoire de la balle — traînée vs prédiction.** Deux interprétations
    du feedback "voir la trajectoire" : (a) traînée (positions passées, pur
    juice, facile) ; (b) ligne de prédiction future (change la stratégie,
    intersecte D06). Trancher laquelle implémenter en premier.

1. Le tilt est-il fun ? (proto 0a — pari central) — validé solo ; à confirmer
   en playtests phase 2.
2. ~~Tuning tilt : alpha 0.3 → 0.5, amplitude 20° → 16°.~~ **Acté (9 juin
   2026, post-playtest #2) :** amplitude 15°, exponent 1.1, alpha 0.45 (voir
   D03 amendement). Sensation "élastique" : abandonnée au profit d'un mapping
   quasi-linéaire. Conflit touch/tilt : à surveiller en playtest.
3. ~~Taille de la balle : voir D20.~~ **Acté (19 juin 2026) :** 20 px / `BALL_RADIUS_NORM = 0.0267` validé en playtests.
4. Indicateur d'approche seul vs pointeur permanent (toggle, phase 2 — D06).
5. Replay atténué du son de frappe adverse (toggle, phase 2 — D08).
6. WebRTC P2P nécessaire ou WebSocket relais suffisant ? (mesure en phase 2).
7. ~~Vitesses de balle : les valeurs de D13 post-playtest sont un premier palier.~~
   **Acté (12 juin 2026) :** vitesses doublées (initial 1.20, max 2.20), courbe logarithmique
   (lerp 0.20) — voir D13 amendement 2.
8. Critère go/no-go phase 2 → phase 3 : "les joueurs redemandent-ils
   spontanément une revanche ?"
9. Validation cross-platform Android : recruter au moins un joueur Android en
   phase 2 (voir D12).
10. ~~Nom du projet : trancher avant toute diffusion publique.~~ **Acté (10 juin
    2026) :** AirPair (voir D15).
11. ~~Identité visuelle AirPair : production du logo SVG (voir D24).~~ **Acté (10 juin 2026) :** logo, favicon, manifest PWA, icônes PNG, apple-touch-icon — installation fonctionnelle iOS + Android.
