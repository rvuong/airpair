# Pong Bros. — Méthodologie SCI (Software Carbon Intensity)

Objectif : mesurer le coût environnemental de la réalisation et de
l'exploitation du projet, produire un rapport global par release, et piloter
une démarche d'amélioration continue.

Référentiel : SCI v1.1, ISO/IEC 21031:2024 (Green Software Foundation).
Formule : **SCI = (E × I + M) par R**
- E : énergie consommée (kWh)
- I : intensité carbone de l'électricité (gCO₂e/kWh)
- M : émissions incorporées du matériel, amorties (gCO₂e)
- R : unité fonctionnelle

## Principes directeurs

1. **Deux volets distincts.** Le SCI ne couvre que l'exploitation. Le rapport
   global comporte donc : (A) coût de RÉALISATION = total ponctuel en kgCO₂e ;
   (B) SCI d'EXPLOITATION = taux en gCO₂e par partie. Lien entre les deux :
   amortissement de (A) sur le nombre cumulé de parties jouées.
2. **Comparaison relative > chiffre absolu.** Les facteurs d'émission sont
   très incertains. La méthode et les facteurs sont figés dans
   `sci/factors.yaml` (versionné) ; tout changement de facteur est documenté
   et les séries historiques recalculées. On compare des versions entre
   elles, pas le projet au reste du monde.
3. **Mesurer réel quand c'est possible, estimer sinon, toujours dire lequel.**
   Chaque chiffre du rapport est étiqueté [mesuré] ou [estimé ± fourchette].
4. **Pas de télémétrie intrusive.** Les compteurs d'exploitation sont
   agrégés côté serveur (parties jouées, octets/partie) ; aucune donnée
   personnelle, aucun tracker tiers (cohérent écoconception ET vie privée).

## Cadrage

- **Unité fonctionnelle R : une partie jouée** (match à 11 points, 2 joueurs,
  durée typique 3-5 min). Comptable côté serveur (événement fin de match).
  Indicateur secondaire : gCO₂e par joueur-minute (pour comparer à d'autres
  loisirs numériques).
- **Périmètre exploitation :** (1) terminaux des 2 joueurs : énergie de la
  session + part d'embodied ; (2) réseau : téléchargement PWA + trafic
  WebSocket + handshakes ; (3) serveur : part de la VM mutualisée du relais.
- **Périmètre réalisation :** énergie du poste de dev, CI/CD, part amortie
  du matériel de dev, usage des assistants IA (Claude Code), hébergement de
  dev. Exclus (négligeables ou non imputables) : chauffage du bureau,
  déplacements.

## Volet A — Mesure de la réalisation

| Poste | Méthode | Type |
|---|---|---|
| Poste de dev (énergie) | Wattmètre de prise (~15 €) sur la multiprise du poste, relevé kWh par session de travail ; à défaut `powermetrics` (macOS) ou estimation P_moyenne × heures loguées | mesuré ou estimé |
| Temps de dev | Journal simple (date, durée, phase, type) dans `sci/worklog.csv`. Inclut : conception (sessions de design, y compris avec IA), développement, mesure SCI elle-même, et rédaction de la documentation/communication (série LinkedIn) | mesuré |
| CI/CD | Minutes GitHub Actions (API) × puissance estimée d'un runner (~12 W attribués) × I datacenter | estimé |
| Assistant IA — Claude Code | Comptage automatique : `npx ccusage@latest daily --project pong-bros --json` (lit les logs locaux ~/.claude/projects/, exhaustif, local). Export hebdomadaire archivé dans `sci/ai-usage/`. Conversion : tokens × facteur d'émission en FOURCHETTE basse/haute (sources citées dans factors.yaml — pas de facteur officiel publié, ~un ordre de grandeur d'incertitude) | tokens mesurés, CO₂e estimé en fourchette |
| Assistant IA — conception (claude.ai) | Pas de compteur exposé : estimation manuelle (nb d'échanges × longueur moyenne), consignée au worklog | estimé |
| Embodied matériel dev | Empreinte fabrication du laptop (fiche constructeur / API Boavizta) × (heures projet / durée de vie totale estimée en heures) | estimé |

Sortie : `kgCO₂e total de réalisation`, ventilé par poste et par phase
(0, 1, 2, 3), mis à jour à chaque fin de phase.

## Volet B — SCI d'exploitation

### B1. Terminaux (poste attendu dominant)

- **E** : protocole de décharge batterie. Téléphone chargé, luminosité fixée
  à 50 %, jouer N parties consécutives, relever le delta de % batterie.
  E_partie = (Δ% / 100) × capacité batterie (iPhone 11 ≈ 11,9 Wh) / N.
  Refaire à chaque release majeure et sur au moins un appareil Android.
- **I** : intensité du réseau électrique local du joueur. Par défaut :
  moyenne France (RTE) pour les mesures locales, moyenne monde en
  sensibilité. Valeurs figées dans factors.yaml.
- **M** : embodied du smartphone (fiche environnementale constructeur — Apple
  publie ~70-80 kgCO₂e pour un iPhone de cette génération, à vérifier sur la
  fiche produit ; sinon API Boavizta) × (durée de la partie / durée de vie
  totale d'usage estimée, hypothèse 4 ans × 3 h/jour). × 2 joueurs.

### B2. Réseau

- **Octets mesurés, pas estimés** : taille du bundle PWA (mesurée en CI à
  chaque build, gzippée) + octets WebSocket par partie (compteur serveur,
  agrégé). Distinguer première visite (bundle complet) et visites suivantes
  (cache service worker → quasi nul) ; pondérer par le taux de retour observé.
- Conversion octets → énergie → CO₂e via **CO2.js** (The Green Web
  Foundation), modèle figé dans factors.yaml.
- Note : grâce à l'architecture (D04), le trafic en partie est ~quelques Ko ;
  le bundle initial dominera ce poste → budget CI (voir plus bas).

### B3. Serveur

- CPU-secondes et octets traités par le process Node (métriques process
  standard), part de VM attribuée, × TDP attribué × PUE estimé du
  datacenter × I de la région d'hébergement.
- Embodied serveur : part au prorata via méthodologie Cloud Carbon
  Footprint / Boavizta.
- Attendu : négligeable devant B1 (un relais WS pour 2 joueurs ne fait
  presque rien) — le mesurer le prouvera.

### Assemblage

- **Impact Framework (GSF)** : manifest `sci/manifest.yaml` versionné dans le
  repo, décrivant l'arbre des composants (terminaux, réseau, serveur), leurs
  observations (données mesurées) et les plugins de conversion. Une commande
  recalcule le SCI ; exécutée à chaque release, résultat archivé dans
  `sci/reports/`.

## Intégration continue (dès maintenant)

Budgets vérifiés en CI à chaque PR (échec si dépassement) :
1. **Poids du bundle** : budget initial 150 Ko gzippé (PWA complète), à
   resserrer après baseline.
2. **Octets par partie** (test automatisé d'un match simulé) : budget 20 Ko.
3. **Score EcoIndex / audit GreenIT-Analysis** sur la page d'accueil :
   cible A, vérification manuelle à chaque release (DOM, poids, requêtes).
4. **Compteurs d'exploitation** côté serveur : parties jouées,
   octets/partie moyens — alimentent le rapport sans télémétrie intrusive.

## Calendrier de mesure

- **Phase 0** : mise en place du worklog + wattmètre. Pas de SCI (pas
  d'exploitation).
- **Fin de phase 1 (MVP)** : **baseline SCI v1** — protocole batterie complet,
  mesures réseau et serveur réelles, premier rapport global (volets A + B).
  C'est la référence de toutes les comparaisons futures.
- **Phase 2** : re-mesure après tuning ; le SCI entre dans les critères de
  design (ex. : durée de zone morte et fréquence de rendu ont un coût
  énergétique mesurable).
- **Chaque release ensuite** : recalcul Impact Framework + delta vs baseline.

## Rapport global (structure)

`sci/reports/YYYY-MM-vX.md` :
1. Résumé : SCI (gCO₂e/partie), delta vs version précédente, total
   réalisation cumulé, parties jouées cumulées, amortissement A/parties.
2. Ventilation par composant (terminaux / réseau / serveur) avec étiquettes
   [mesuré]/[estimé].
3. Hypothèses et facteurs (lien factors.yaml, version).
4. Actions d'amélioration décidées + effet attendu.
5. Limites et incertitudes (sans langue de bois).

## Leviers d'amélioration identifiés a priori

- **Compatibilité appareils anciens** (levier n°1 sur M, le poste dominant) :
  cibles navigateur larges, exigences capteurs minimales, perfs correctes sur
  matériel ancien → le jeu ne pousse personne à changer de téléphone.
- Fréquence de rendu : cap à 60 fps, pas de rendu quand l'app est en
  arrière-plan ou la balle chez l'adversaire (écran quasi statique).
- Fond sombre : gain réel sur OLED (la plupart des Android et iPhone
  récents), nul sur LCD (iPhone 11) — Pong est naturellement noir, l'assumer.
- Bundle : zéro framework UI, assets audio courts et compressés, pas de
  fonts externes, cache service worker agressif.
- Réseau : déjà minimal par architecture (D04) — maintenir via le budget CI.
- Serveur : mutualisation maximale (tier partagé), arrêt/scale-to-zero hors
  usage si l'hébergeur le permet.

## Outillage récapitulatif

| Besoin | Outil |
|---|---|
| Calcul/assemblage SCI | Impact Framework (GSF) — manifest versionné |
| Octets → CO₂e réseau | CO2.js (The Green Web Foundation) |
| Embodied matériel | Fiches environnementales constructeurs, API Boavizta |
| Audit page web | EcoIndex + extension GreenIT-Analysis, Lighthouse |
| Énergie poste dev | Wattmètre de prise ; powermetrics (macOS) |
| Énergie smartphone | Protocole de décharge batterie (manuel, documenté) |
| Serveur | Métriques process Node + méthodologie Cloud Carbon Footprint |
