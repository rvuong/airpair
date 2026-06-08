# Pong Bros. — Journal de décisions

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
trancher en playtest.

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
(c) tier gratuit Render/Fly.io/Railway pour le serveur WS ; (d) EC2/Lightsail.

**Décision.** Client statique : **GitHub Pages** (gratuit, HTTPS natif —
indispensable pour capteurs et caméra, déploiement par push). S3 seul écarté :
endpoint website HTTP uniquement, il faudrait CloudFront pour du HTTPS = de la
config pour rien à ce stade. Serveur WS : **tier gratuit externe** en phase 1 ;
migration vers l'AWS disponible plus tard si "go" (TLS et maintien en vie à
gérer soi-même).

**Dev local :** Vite en HTTPS sur réseau local (`@vitejs/plugin-basic-ssl`),
certificat à accepter sur l'iPhone — itération sans déploiement.

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

**Proto 0b à un seul iPhone :** second client = navigateur desktop
clavier/souris, suffisant pour valider la synchro. Test à deux vrais
téléphones (emprunter un Android = validation cross-platform) en phase 1.

---

## D13 — Règles du jeu ✅ (non prépondérant)

Matchs en 11 points, 2 points d'écart, service alterné tous les 2 points,
vitesse de balle croissante à chaque échange (sinon échanges interminables —
défaut connu de Pong). Point quand l'adversaire rate. Détail des règles : pas
prioritaire avant la phase 2.

---

## D14 — Effets de balle ⏸ (phase 3)

Coup de poignet sec à la frappe = effet lifté/coupé courbant la trajectoire.
Le gyroscope détecte très bien ce geste (rotation = son point fort, contraste
avec D03). Explicitement hors MVP.

---

## D15 — Nom du projet ✅ (non bloquant)

**Décision :** nom de travail **"Pong Bros."** — orientation "je joue avec mon
pote". Signaux pour plus tard : "PONG" est une marque Atari toujours défendue ;
"Bros." évoque Nintendo. Sans risque pour un projet perso ; à renommer avant
toute publication store. Alternatives en réserve : PingBros, PongPals,
Bounce Bros, Face2Ball.

---

## D16 — Documentation du projet ✅

`PROJECT.md` = état courant, court (< 200 lignes), contexte d'entrée pour
Claude Code. `docs/decisions.md` (ce fichier) = le pourquoi, par sujet, amendé
au fil des décisions — préféré à une synthèse narrative de conversation, qui
vieillit mal et mélange décisions actées et supersédées. Specs détaillées dans
`docs/*.md` au fil de l'eau.

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

## Questions ouvertes (à trancher par prototype/playtest)

1. Le tilt est-il fun ? (proto 0a — pari central) — validé solo ; à confirmer
   en playtests phase 1 avec plusieurs joueurs.
2. Valeurs de tuning : zone morte du tilt, amplitude, exposant, lissage,
   durée de traversée de la zone morte, vitesses de balle, taille de raquette.
3. Indicateur d'approche seul vs pointeur permanent (toggle, phase 2 — D06).
4. Replay atténué du son de frappe adverse (toggle, phase 2 — D08).
5. WebRTC P2P nécessaire ou WebSocket relais suffisant ? (mesure en phase 2).
6. Critère go/no-go fin de phase 1 : "les joueurs redemandent-ils
   spontanément une revanche ?"

---

## D17 — Démarche d'ingénierie responsable (SCI) ✅

**Contexte.** Volonté de mesurer le coût environnemental de la réalisation et
de l'exploitation, avec un rapport global et une boucle d'amélioration.
Référentiel : Software Carbon Intensity (GSF, ISO/IEC 21031:2024).

**Décisions de cadrage.** (1) Deux volets : coût de réalisation = total
ponctuel en kgCO₂e (le SCI ne couvre pas le dev), SCI d'exploitation = taux ;
lien par amortissement du total sur les parties cumulées. (2) Unité
fonctionnelle R = une partie jouée. (3) Facteurs d'émission figés et
versionnés (`sci/factors.yaml`) : la valeur est dans la comparaison relative
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
release dans `sci/reports/`. Usage IA (Claude Code) inclus dans le volet
réalisation, rapporté en fourchette (forte incertitude). Détail complet :
`docs/sci.md`.

---

## D18 — Documentation publique : série LinkedIn ✅

**Contexte.** Volonté de documenter la démarche globale de réalisation sous
forme d'épisodes (posts/articles LinkedIn).

**Décision.** Série "journal de bord" dont la matière première est
`docs/decisions.md` (1 épisode = 1 décision ou 1 résultat + 1 leçon
transférable). Plan éditorial, gabarit et garde-fous dans `docs/linkedin.md` ;
brouillons dans `docs/episodes/`, rédigés à chaud à chaque jalon, publiés
après relecture à froid. Cadence calée sur l'avancement réel.

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

## D17bis — Précision volet réalisation : mesure de l'usage IA ✅

Amendement de D17 suite à question : la réalisation (conception comprise) EST
mesurée — volet A de docs/sci.md — mais rapportée en total (kgCO₂e), distinct
du taux SCI d'exploitation, avec pont par amortissement sur les parties
cumulées. Protocole tokens précisé : Claude Code compté exhaustivement via
ccusage (logs locaux, export hebdo dans sci/ai-usage/) ; sessions de
conception claude.ai estimées manuellement au worklog ; conversion CO₂e en
fourchette basse/haute (aucun facteur officiel par token, ~1 ordre de
grandeur d'incertitude, sources dans factors.yaml).
