# Pong Bros. — Série LinkedIn "journal de bord"

Objectif : documenter la démarche globale (design, technique, IA, ingénierie
responsable) en épisodes. Chaque épisode = UNE décision ou UN résultat + UNE
leçon transférable au-delà du projet. Matière première : `docs/decisions.md`
(chaque entrée Dxx est un épisode potentiel : problème → options → arbitrage
→ leçon).

## Ligne éditoriale

- **Honnêteté radicale** : montrer les impasses, les pivots, les chiffres
  décevants. C'est ce qui différencie un journal de bord d'une promo.
- **Leçon transférable** : le lecteur ne fera jamais ce jeu, mais il a un
  projet à lui. Chaque épisode se termine par ce qu'il peut en réutiliser.
- **Un épisode = une idée.** Pas de résumé de sprint fourre-tout.
- **Format** : post court (900-1 300 caractères) par défaut ; article long
  LinkedIn uniquement pour les bilans de phase. Accroche en première ligne
  (avant le "voir plus"). 1 visuel par post : capture, schéma, ou chiffre
  mis en scène. Pas de jargon non expliqué.
- **Langue** : français (audience visée FR ; basculer EN si la traction
  vient de l'international).
- **Cadence** : calée sur l'avancement réel, pas sur un calendrier. Cible
  ~1 épisode / 1-2 semaines. Garder 1-2 épisodes d'avance en brouillon.
- **Workflow** : rédiger le brouillon À CHAUD à chaque jalon (15 min, dans
  `docs/episodes/`), publier après relecture à froid. Le temps de rédaction
  est consigné au worklog SCI (volet réalisation).

## Plan d'épisodes (provisoire — s'adapte aux résultats réels)

| # | Titre de travail | Source | Leçon transférable |
|---|---|---|---|
| 1 | Un Pong à deux téléphones, face à face : l'idée et son moment magique | Intention | Identifier LE moment magique d'un produit et tout y subordonner |
| 2 | Comment j'ai supprimé 60 % de la complexité avant d'écrire une ligne de code | D01, D02 | Challenger les exigences implicites (localiser ≠ nécessaire) |
| 3 | Votre accéléromètre ne sait pas où il est (et pourquoi c'est important) | D03 | Connaître les limites physiques des capteurs avant de designer dessus |
| 4 | Le netcode le plus simple du monde : quand le déterminisme remplace le streaming | D04, D05 | Exploiter les propriétés du domaine pour simplifier l'architecture |
| 5 | Designer avec une IA : ce que Claude a challengé (et où j'ai dit non) | Conversation de conception | L'IA comme sparring partner, pas comme oracle ; garder l'arbitrage |
| 6 | Proto 0a : le tilt est-il fun ? Résultats du premier test qui peut tuer le projet | Phase 0 | Tester le risque principal en premier, avec un critère d'arrêt écrit |
| 7 | Moins montrer pour mieux jouer : pourquoi j'ai refusé d'afficher la balle adverse | D06, D07, D08 | Le retrait d'information comme outil de design (tension, regard) |
| 8 | Mesurer le CO₂ d'un side project : mise en place du SCI (ISO 21031) | D17 | Une méthode de mesure proportionnée, comparaison relative > chiffre absolu |
| 9 | Combien "coûte" l'IA de mon projet ? Tokens, fourchettes et honnêteté | Volet A SCI, ccusage | Mesurer son usage IA ; assumer l'incertitude en fourchette |
| 10 | MVP : la première vraie partie (et tout ce qui a cassé) | Phase 1 | Le chemin entre "ça marche en démo" et "ça marche chez les autres" |
| 11 | Go ou no-go : "est-ce qu'ils redemandent une revanche ?" | Fin phase 1 | Choisir un critère de décision honnête AVANT de voir les résultats |
| 12 | Ce que les playtests ont détruit dans mes certitudes | Phase 2 | Tuning par l'observation ; les joueurs ne font jamais ce qu'on prévoit |
| 13 | Bilan carbone v1 : le poste dominant n'est pas celui que vous croyez | Baseline SCI | L'embodied des terminaux domine → supporter les vieux appareils |
| 14 | Bilan de la démarche : ce que je referais, ce que j'abandonnerais | Rétro globale | Article long de synthèse |

Épisodes bonus selon l'actualité du projet : les pièges iOS d'une PWA (D12),
choisir un nom sans se faire attaquer par Atari (D15), CLAUDE.md en français
ou en anglais.

## Gabarit d'épisode (docs/episodes/NN-titre.md)

```
Accroche (1 ligne, concrète, sans teasing creux)
Contexte (2-3 lignes : où en est le projet)
Le problème / la question
Ce que j'ai essayé ou arbitré (avec le chiffre ou la capture)
La leçon transférable (1-2 lignes)
[Question ouverte à l'audience — optionnelle, sincère]
Visuel : …
```

## Garde-fous

- Ne jamais publier un épisode qui précède la réalité (pas de "ça marche"
  avant que ça marche).
- Les chiffres SCI publiés suivent les règles de docs/sci.md : étiquettes
  [mesuré]/[estimé], fourchettes, méthode citée.
- La série documente la démarche ; elle ne doit pas la déformer (ne pas
  choisir une option parce qu'elle "fait un meilleur post").
