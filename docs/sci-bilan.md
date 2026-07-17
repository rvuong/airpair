# AirPair — Bilan Software Carbon Intensity

**Phase 1 · 19 juin 2026 · mise à jour phase 3 · 10 juillet 2026 · SCI v1.1 / ISO IEC 21031:2024**

---

## Note de correction (10 juillet 2026)

Le bilan du 19 juin utilisait `ccusage` en mode **global** (toutes sessions Claude Code confondues, tous projets) comme mesure de la consommation "airpair". Or `ccusage` ne sait pas filtrer par projet : sur la période W20-W25, le poste de travail a aussi tourné des sessions Believe et d'autres side-projects (bff-accounts, contracts-account, ce dossier de personal branding, etc.). Le chiffre "442 M tokens bruts" du bilan initial n'était donc pas le coût d'airpair seul.

**Chiffre corrigé**, scope projet (`sci/extract-ai-usage.py`, lecture des logs locaux du dossier `airpair` uniquement, dédup par `requestId`) : **125,6 M tokens bruts cumulés au 19 juin** (au lieu de 442 M) — soit un facteur ~3,5 de surestimation dans le bilan initial.

`ccusage` global est abandonné à partir de ce bilan. `extract-ai-usage.py` (scope projet) devient la seule source pour le poste Claude Code — voir la note méthodologique ajoutée dans [`docs/sci.md`](sci.md).

**Limite résiduelle connue :** les logs antérieurs au renommage du projet (`pongbros` → `airpair`, acté le 10 juin, voir D15) sont en partie stockés sous l'ancien nom de dossier. Un seul fichier de session concerné a été identifié (10 juin, session déjà trouvée pour l'essentiel côté `airpair`) — impact estimé négligeable. La phase de conception (7-9 juin) reste couverte séparément par l'estimation manuelle `claude.ai` du worklog, non par cette extraction.

## Note sur la volatilité des logs locaux (découverte le 10 juillet 2026)

Les logs Claude Code par projet (`~/.claude/projects/.../*.jsonl`) ne sont **pas une archive stable** : deux exécutions de `extract-ai-usage.py` à ~20 minutes d'intervalle, dans la même session de travail, ont donné des résultats différents — 45 fichiers / 2 271 requêtes puis 40 fichiers / 1 695 requêtes. Des sessions se sont fait purger localement pendant qu'on mesurait.

Conséquence directe pour la méthode : **toute mesure "réelle" de tokens Claude Code est un plancher, pas un total exact**, et le plancher baisse avec le temps si l'export n'est pas archivé rapidement. Les chiffres de ce bilan utilisent la première extraction de la session (la plus complète disponible) ; l'export archivé dans `sci/ai-usage/2026-07-10.json` (capturé après la purge partielle) est donc lui-même un sous-ensemble, et sert de repère plancher pour la suite, pas de vérité complète.

**Action retenue :** archiver `extract-ai-usage.py --save` plus fréquemment (à chaque session de travail notable, pas seulement en fin de phase) pour limiter la perte future. Documenté dans `docs/sci.md`.

---

## Claude Code — consommation cumulée (scope projet, corrigé)

Source : `sci/extract-ai-usage.py`, logs locaux du dossier `airpair`, dédupliqués par `requestId`. Coupure au 19 juin (date du bilan initial) pour séparer phase 0/1 (déjà rapportée) de la période phase 2/3 non encore bilanée.

| Période | Phase | Tokens bruts | Input | Output | Cache création | Cache lecture | Effectifs (hors cache lecture) |
|---|---|---|---|---|---|---|---|
| ≤ 19 juin | conception → phase 1 | 125,6 M | 18,3 k | 913,5 k | 3,04 M | 121,6 M (96,8 %) | 3,97 M |
| 20 juin → 10 juillet | phase 2 → phase 3 | 99,7 M | 36,7 k | 541,9 k | 1,83 M | 97,2 M (97,6 %) | 2,41 M |
| **Total à date** | | **225,3 M** | **55,0 k** | **1,46 M** | **4,87 M** | **218,9 M (97,2 %)** | **6,38 M** |

Le fait marquant de la période phase 2/3 : la quasi-totalité de l'effort (`tokens effectifs`) correspond à une seule tâche — le fix `tilt/touch-exclusivity` du 2 juillet (3 itérations d'UI documentées dans `decisions.md` D03) — le reste de la fenêtre (23 juin → 2 juillet) a été calme.

### CO₂e — méthode

Facteurs `sci/factors.yaml › ai_inference` (aucun facteur officiel publié par Anthropic — fourchette de la littérature, incertitude ~1 ordre de grandeur) :
- **Raisonnable** : tokens effectifs (hors cache lecture) × facteur output (0,001 - 0,010 gCO₂e / 1k tokens). Le cache lecture est traité comme un coût quasi nul (relecture depuis la mémoire KV, pas de recalcul GPU).
- **Pire cas** : ajoute le cache lecture au coût plein, traité comme du contexte réinjecté (facteur input haut, 0,003 gCO₂e / 1k tokens) — hypothèse volontairement pessimiste.

*(Révision de méthode vs. le bilan du 19 juin : le calcul du pire cas y appliquait un multiplicateur ad hoc `×6,4` non reproductible sur le total "raisonnable". Ici, formule directe et traçable.)*

| Période | Raisonnable | Pire cas |
|---|---|---|
| ≤ 19 juin | 3,97 g – 39,7 g | 404,6 g |
| 20 juin → 10 juillet | 2,41 g – 24,1 g | 315,8 g |
| **Total à date** | **6,38 g – 63,8 g** | **720,4 g** |

---

## Sessions manuelles (worklog)

Activités hors Claude Code : sessions claude.ai web, temps humain, playtests terrain. Source : [`sci/worklog.csv`](../sci/worklog.csv).

| Date | Phase | Activité | Outil | Mix réseau | Durée | CO₂e min | CO₂e max |
|------|-------|----------|-------|-----------|-------|----------|----------|
| 2026-06-07 | conception | Design complet, docs (PROJECT.md, decisions.md, sci.md…) | claude.ai | US ~400 g/kWh | — | 5 g | 75 g |
| 2026-06-07 | conception | Énergie poste de travail (sessions claude.ai) | laptop | FR 52 g/kWh | — | 2 g | 30 g |
| 2026-06-11 | phase 1 | Playtests terrain W24 — 2 sessions | smartphone | FR 52 g/kWh | 4 h | 1 g | 2 g |
| 2026-06-11 | phase 1 | Sessions claude.ai — challenger idées game design | claude.ai | US ~400 g/kWh | 3,5 h | 2 g | 60 g |
| 2026-06-11 | phase 1 | Synthèse playtests — rédaction notes et décisions | laptop | FR 52 g/kWh | 2 h | 2 g | 6 g |
| 2026-06-17 | phase 1 | Playtest terrain W25 — 1 session | smartphone | FR 52 g/kWh | 2 h | 0 g | 1 g |
| 2026-06-21 | phase 1 | Approach indicator v2 — design (D06) + implémentation | claude.ai | US ~400 g/kWh | 1 h | 5 g | 50 g |
| 2026-06-21 | phase 2 | Playtest #5 + analyse + fix touch/tilt + go phase 3 | laptop | FR 52 g/kWh | 1 h | 10 g | 40 g |
| 2026-07-02 | phase 3 | Test manuel solo (device réel) — validation UI tilt/touch | smartphone | FR 52 g/kWh | 0,75 h | 0 g | 1 g |

*Les sessions Claude Code (rédaction, fixes, implémentation) ne figurent pas dans ce tableau — comptées automatiquement, voir section précédente.*

**Totaux par outil :**

| Outil | CO₂e min | CO₂e max |
|---|---|---|
| claude.ai web | 12 g | 185 g |
| laptop (temps humain) | 14 g | 76 g |
| smartphones (playtests/tests) | 1 g | 4 g |

---

## CO₂e — empreinte estimée totale

**Valeurs cumulées, conception → phase 3 (à date, 10 juillet 2026).**

| Composant | Hypothèse | Fourchette basse | Fourchette haute |
|-----------|-----------|-----------------|-----------------|
| Claude Code (scope projet, corrigé) | Cache lecture ≈ coût nul | 6 g | 64 g |
| claude.ai web (sessions manuelles) | Estimation par nb d'échanges | 12 g | 185 g |
| Laptop (sessions manuelles) | Puissance × durée × mix FR | 14 g | 76 g |
| Smartphones (playtests/tests) | Puissance active × durée × mix FR | 1 g | 4 g |
| **Total — fourchette raisonnable** | | **33 g** | **329 g** |
| Claude Code — pire cas (cache lecture à coût plein) | | — | 720 g |
| **Total — pire cas** | | — | **~985 g** |

Le total raisonnable (33-329 g) est proche du chiffre du 19 juin (32-384 g) malgré la correction de méthode — la baisse du poste Claude Code (20-210g → 6-64g) est en grande partie compensée par l'ajout des sessions manuelles phase 1/2 non encore bilanées au 19 juin (approach indicator, playtest #5). Ce n'est pas une coïncidence rassurante : c'est le signe que le poste Claude Code n'était de toute façon pas dominant dans le total, contrairement à ce que la lecture brute du chiffre "442 M tokens" du 19 juin laissait penser.

### Équivalents CO₂e — fourchette raisonnable cumulée (33–329 g)

| | Fourchette raisonnable | Pire cas (~985 g) |
|-|----------------------|---------------------|
| 🚗 Voiture essence | 165 m – 1,6 km | 4,9 km |
| ☕ Café en dosette | 1 – 8 capsules | 25 capsules |
| 🥩 Viande rouge (bœuf) | 1 – 12 g de bœuf | 36 g de bœuf |
| 📺 Vidéo YouTube (HD, WiFi) | 55 min – 9 h | ~27 h |

*Sources : ADEME — 200 gCO₂e/km (voiture moyenne essence), 40 gCO₂e/capsule (café), 27 kgCO₂e/kg (bœuf France). IEA 2020 — 36 gCO₂e/h (streaming HD WiFi, mix mondial).*

---

## Méthode et sources

- **Méthodologie SCI** : [`docs/sci.md`](sci.md) — voir note méthodologique sur `ccusage` global vs. scope projet, et sur la volatilité des logs locaux.
- **Facteurs d'émission** (gelés phase 1) : [`sci/factors.yaml`](../sci/factors.yaml) v1.0.0 — 2026-06-11
- **Données Claude Code (scope projet)** : `sci/ai-usage/2026-07-10.json` — export `python3 sci/extract-ai-usage.py --save`. Les exports hebdomadaires `ccusage` (`2026-W20.json` … `2026-W25.json`) restent archivés à titre historique mais ne sont plus utilisés pour le calcul (contamination multi-projets).
- **Sessions manuelles** : `sci/worklog.csv`
- **Volet B (exploitation)** : toujours non mesuré — aucune release en production avec joueurs réels au-delà des playtests terrain à ce stade. Prévu à la prochaine release majeure (cf. calendrier de mesure, `sci.md`).

---

## Point hebdo — rattrapage W26–W29 (17 juillet 2026)

Les exports hebdomadaires s'arrêtaient à W25 (générés le 19 juin). Rattrapage effectué avec la méthode corrigée (scope projet, `requestId`), via un nouveau script [`sci/extract-weekly-usage.py`](../sci/extract-weekly-usage.py) (`--save`) qui découpe les logs locaux par semaine ISO — les fichiers `sci/ai-usage/2026-W26…W29.json` restent locaux (dossier gitignoré).

| Semaine | Tokens bruts | CO₂e raisonnable |
|---------|-------------|------------------|
| W26 (22–28 juin) | 13,9 M | 0,35–3,5 g |
| W27 (29 juin–5 juil) | 42,3 M | 0,69–6,9 g |
| W28 (6–12 juil) | 1,7 M | 0,25–2,5 g |
| W29 (13–19 juil) | 6,7 M | 0,30–3,0 g |
| **Total W26–W29** | **64,6 M** | **1,6–16 g** (pire cas ~194 g) |

L'essentiel se concentre sur W26–W27 (fix tilt/touch-exclusivity du 2 juillet, cf. D03) ; phase 3 quasi en pause depuis le 10 juillet. Deux entrées `worklog.csv` (30 juin, 2 juillet) complétées à cette occasion par extraction fine `requestId` depuis l'export W27. Restent en `A_COMPLETER` : les postes de conception sans wattmètre (impact < 100 g) et la session phase 0 sous l'ancien dossier `pongbros`.
