# Runbook — Résilience du serveur WS

> **Statut : PLANIFIÉ, non exécuté.** À appliquer plus tard.
> Rédigé suite à l'incident du 2026-07-19.
> **Ré-analysé et réordonné le 2026-07-30 — voir D27 dans [`docs/decisions.md`](./decisions.md).**
> ⚠️ La première version de ce runbook présentait swap et `max_memory_restart` comme
> traitant « la cause ». C'est faux : ce sont des **filets**, et appliqués avant le
> diagnostic ils effacent le signal qu'on cherche. L'ordre d'exécution ci-dessous a
> changé en conséquence.

## Contexte de l'incident

- **Symptôme** : plus de QR code sur le jeu déployé (https://rvuong.github.io/airpair/).
  Le QR n'est rendu qu'après réponse du serveur (`client.onCreated`, `src/screens/host.ts`).
  Serveur injoignable → pas de room → pas de QR. Le jeu est **totalement inutilisable** :
  l'appairage est le seul point d'entrée.
- **Constat** : l'EC2 était `running` mais **Instance status = impaired** (OS figé,
  ports 22/80/443 en timeout).
- **Hypothèse initiale** : **OOM** — la t4g.nano n'a que **512 Mo de RAM**.
  ⚠️ Hypothèse **non vérifiée** : EC2 ne publie aucune métrique RAM par défaut.
  `impaired` ne dit pas *pourquoi* l'OS a figé.
- **Fix appliqué** : `stop` → `start` (power-cycle matériel ; sur un OS mort le reboot
  API ne suffit pas). EIP et EBS conservés.

## Ré-analyse (2026-07-30)

**La vraie question n'est pas « comment absorber la saturation » mais « pourquoi 512 Mo
sont atteints par un relais de 162 lignes ».** Un Node qui fait tourner `server/server.ts`
(deux `Map` de quelques rooms, aucun buffer) idle autour de 50 Mo.

**Ce que les dates écartent.** Dernier déploiement serveur : **10 juin**. Incident :
**19 juillet**. 39 jours — le process tournait sans interruption depuis plus d'un mois.
Le pic de déploiement n'est donc **pas** le déclencheur de cet incident. Il reste un
risque latent réel : `deploy-server.yml` compile sur l'instance de prod (`npm ci`,
`npm install --save-dev typescript`, `npx tsc` — un `tsc` culmine à 150–300 Mo de RSS),
sans stopper l'app avant (`pm2 reload` vient après). Sur 512 Mo partagés avec Ubuntu,
le daemon pm2 (lui-même un Node) et l'app, ce pic finira par tomber au mauvais moment.

**Ce que le code montre** (`server/server.ts`) — rétentions vraies quelle qu'ait été la
cause du 19 juillet :

| # | Rétention | Où | Effet |
|---|---|---|---|
| 1 | **Aucun heartbeat** `ping`/`pong`, ni `isAlive`, ni timeout | tout le fichier | `ws` ne détecte pas les TCP semi-ouvertes. Mobile en tunnel / app tuée / bascule 4G↔WiFi → `close` jamais émis. Socket + room retenus indéfiniment. **Cas nominal sur mobile, pas cas rare.** |
| 2 | `clientToRoom.delete(peer)` manquant | `server.ts:110-111` | Une entrée orpheline **par partie terminée**, pointant vers une room disparue. `Map` clé-sur-WebSocket = référence forte → socket et buffers non collectables. |
| 3 | Pas de `ws.close()` sur les chemins d'erreur | `server.ts:51-59`, `126`, `147` | `room_not_found`, `room_full`, `invalid_json`, `unknown_type` laissent la connexion ouverte et non enregistrée, pour toujours. Port 443 public → tout scanner laisse un socket pendant. |
| 4 | Aucun plafond (rooms, connexions/IP, rate limit) | — | Rien ne borne la croissance. |

**Hypothèse concurrente jamais écartée.** Chaque `[CONNECT]`/`[CREATE]`/`[JOIN]`/
`[DISCONNECT]` part dans les logs pm2 et **aucun `pm2-logrotate` n'est configuré**.
Un `/` saturé sur le volume de 8 Go produit exactement le même `impaired`. À vérifier
avant de conclure à l'OOM.

## Ressources concernées

| Élément | Valeur |
|---|---|
| Instance | `i-00d544c3b5e3ea343` (t4g.nano) |
| Région | `eu-west-1` ⚠️ (profil AWS par défaut = eu-west-3, toujours passer `--region eu-west-1`) |
| Volume EBS | `vol-07d4fb98fedd8f7a4` — gp3 8 Go, 3000 IOPS / 125 Mo/s (baseline incluse) |
| EIP / URL | `52.214.224.248` → `wss://ws.odomate.eu` |
| Compte AWS | 590183845046 (user `rvuong`) |
| Process | pm2 `airpair-server` (voir `.github/workflows/deploy-server.yml`) |

## Prérequis

- Accès **SSH** OU **SSM Session Manager** à l'instance — requis pour les **étapes 0, 1
  et 4 (options 1-2)**. Bloquant : sans accès, rien de tout ça n'est applicable.
  - NB : au moment de l'incident, l'agent SSM ne remontait pas (`describe-instance-information` vide).
    Vérifier/installer l'agent SSM si on veut passer par SSM plutôt que SSH.
- CLI AWS configurée (étape 4, option 3) — déjà OK sur le poste.
- Les **étapes 2 et 3** sont du code : PR normale, aucun accès serveur nécessaire.

## Impact FinOps (récapitulatif)

Repère : instance ≈ **€3,40–4/mois**.

| Étape | Coût récurrent | One-shot | Traite |
|---|---|---|---|
| 0. Forensique | €0 | €0 | le **diagnostic** |
| 1. Mesure RSS via pm2 | **€0/mois** | €0 | le **diagnostic** |
| 2. Correctifs `server.ts` | €0 | €0 | la **cause** |
| 3. Build hors prod | €0 | €0 | la **cause** (pic latent) |
| 4a. Swap 1 Go | **€0/mois** (dans les 8 Go déjà alloués) | €0 | un **filet** |
| 4b. `max_memory_restart` pm2 | **€0/mois** | €0 | un **filet** |
| 4c. Alarme CloudWatch reboot | **~€0,09/mois** (~€1,1/an) | €0 | le **symptôme** |

Total si tout pris ≈ **€1,1/an** (~2 % du coût annuel de l'instance).

---

## Étape 0 — Forensique (à faire AVANT tout le reste, gratuit)

Sans ça, on corrige une hypothèse. Sur l'instance :

```bash
# L'OOM-killer a-t-il tiré, et sur quel process ?
journalctl -k | grep -i "out of memory"
dmesg -T | grep -i -E "oom|killed process"

# Hypothèse concurrente : disque plein (mêmes symptômes)
df -h /
du -sh ~/.pm2/logs/*

# Uptime du process et RSS courant
pm2 show airpair-server
```

> ⚠️ **Réserve** : le `stop`/`start` du 19 juillet est passé, et `journalctl` ne survit
> au reboot que si `/var/log/journal` existe (sinon journal en tmpfs). Si la preuve est
> perdue : passer à l'étape 1, instrumenter, et attendre la prochaine occurrence.

**Lecture du résultat.**
- OOM-killer sur `node dist/server.js` après des semaines d'uptime → fuite : étape 2.
- OOM-killer sur `tsc`/`npm` → pic de déploiement : étape 3 (mais incompatible avec les
  dates de cet incident, cf. ré-analyse).
- `/` à 100 % → logs pm2 non rotés : installer `pm2-logrotate`, l'OOM n'était pas la cause.
- Rien de concluant → étape 1 et attendre.

## Étape 1 — Mesurer la mémoire (gratuit)

EC2 ne publie pas la RAM. pm2 la connaît déjà : suffit de l'échantillonner.

```bash
# Script d'échantillonnage (node est garanti présent, l'app tourne dessus)
cat > /home/ubuntu/sample-rss.sh <<'SH'
#!/bin/bash
RSS=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const p=JSON.parse(s).find(x=>x.name==="airpair-server");
  console.log(p ? p.monit.memory : "NA")})')
echo "$(date -Is) $RSS" >> /home/ubuntu/rss.log
SH
chmod +x /home/ubuntu/sample-rss.sh

# Toutes les 5 min
(crontab -l 2>/dev/null; echo '*/5 * * * * /home/ubuntu/sample-rss.sh') | crontab -
```

**Vérification** : `/home/ubuntu/sample-rss.sh && tail -2 /home/ubuntu/rss.log`
→ deux colonnes, horodatage ISO et octets (pas `NA`).

**Lecture** : courbe croissante monotone sur plusieurs jours = fuite (étape 2) ;
plateau avec pics = pression ponctuelle (étape 3 / filets).

**Rollback** : `crontab -e` (supprimer la ligne) puis `rm /home/ubuntu/sample-rss.sh /home/ubuntu/rss.log`.

## Étape 2 — Corriger les rétentions de `server/server.ts`

~30 lignes dans un fichier de 162. Recoupe deux items déjà inscrits en phase 3
(gestion déconnexions/reprises, garde-fous d'appairage) — voir D27 dans [`docs/decisions.md`](./decisions.md).

1. **Heartbeat** : `ws.on('pong', …)` + flag `isAlive`, `setInterval` ~30 s qui
   `ws.terminate()` les sockets sans pong. Seul mécanisme qui détecte une TCP
   semi-ouverte — indispensable sur une cible 100 % mobile.
2. **`clientToRoom.delete(peer)`** dans `handleDisconnect` (`server.ts:110-111`).
3. **`ws.close()`** sur tous les chemins d'erreur (`server.ts:51-59`, `126`, `147`).
4. **Plafonds** : nombre de rooms, connexions par IP.

Chaque point est testable localement (ouvrir N sockets, couper le réseau brutalement,
vérifier que `rooms.size` et `clientToRoom.size` retombent à 0).

## Étape 3 — Sortir la compilation de la prod

`deploy-server.yml` fait aujourd'hui `npm ci` + `npm install --save-dev typescript` +
`npx tsc` **sur l'instance**, app toujours en cours d'exécution. À remplacer par : build
dans le runner GitHub Actions, puis expédition de `dist/` (rsync/scp) et `pm2 reload`.
Supprime le pic de 150–300 Mo et raccourcit le déploiement.

---

# Étape 4 — Filets (après l'étape 2, pas à sa place)

## Option 1 — Swap 1 Go (gratuit)

Empêche l'OOM-killer/kernel-hang en donnant une soupape mémoire. `swappiness` bas =
filet de sécurité, pas usage routinier.

> ⚠️ Appliqué avant l'étape 0, le swap transforme un OOM en thrashing : l'OS survit,
> dégradé, et le symptôme qu'on cherchait à observer disparaît.

```bash
# Sur l'instance (SSH ou SSM), Ubuntu :
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persistance au boot
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Swap utilisé seulement sous forte pression mémoire
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
```

**Vérification :**
```bash
swapon --show      # doit lister /swapfile, 1G
free -h            # colonne Swap : 1.0Gi
```

**Rollback :**
```bash
sudo swapoff /swapfile
sudo sed -i '\#/swapfile none swap#d' /etc/fstab
sudo rm -f /swapfile /etc/sysctl.d/99-swap.conf
```

---

## Option 2 — `max_memory_restart` pm2 (gratuit)

Redémarre le process **avant** qu'il ne fasse tomber l'OS. Seuil bien sous les 512 Mo.

> ⚠️ Sur un process qui fuit encore, ceci signifie « redémarre toutes les N semaines
> sans jamais comprendre » : la panne franche devient un redémarrage silencieux
> récurrent. À ne poser qu'après l'étape 2.

```bash
# Sur l'instance :
pm2 restart airpair-server --max-memory-restart 250M
pm2 save
```

**Durabilité (important)** : `deploy-server.yml` recrée le process via
`pm2 reload … || pm2 start dist/server.js --name airpair-server`. Sans persistance,
le flag saute au prochain déploiement. Deux façons de le rendre permanent :

- **A (simple)** : ajouter `--max-memory-restart 250M` à la ligne `pm2 start` du workflow
  `.github/workflows/deploy-server.yml`.
- **B (propre)** : créer un `ecosystem.config.js` côté serveur avec
  `max_memory_restart: '250M'` et déployer via `pm2 start ecosystem.config.js`.

**Vérification :**
```bash
pm2 show airpair-server | grep -i "max memory restart"
```

**Rollback :**
```bash
pm2 restart airpair-server --max-memory-restart 0   # 0 = désactivé
pm2 save
```

---

## Option 3 — Alarme CloudWatch (filet de sécurité, ~€1/an)

⚠️ **Correction vs suggestion initiale** : l'incident était `StatusCheckFailed_Instance`
(niveau OS), pas `_System` (niveau hôte). L'action `recover` ne traite que les pannes
**System**. Pour un OOM/OS-hang, l'action pertinente est un **reboot** sur
`StatusCheckFailed_Instance`.

> Limite connue : si l'OS est totalement mort, le reboot API peut échouer.
> C'est pourquoi les options 1 & 2 (qui traitent la cause) restent prioritaires ;
> celle-ci est un filet.

```bash
aws cloudwatch put-metric-alarm \
  --region eu-west-1 \
  --alarm-name "pongbros-ws-instance-impaired-reboot" \
  --alarm-description "Reboot auto si StatusCheckFailed_Instance (OS hang / OOM) sur le serveur WS" \
  --namespace AWS/EC2 \
  --metric-name StatusCheckFailed_Instance \
  --dimensions Name=InstanceId,Value=i-00d544c3b5e3ea343 \
  --statistic Maximum \
  --period 60 \
  --evaluation-periods 3 \
  --datapoints-to-alarm 3 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data missing \
  --alarm-actions arn:aws:automate:eu-west-1:ec2:reboot
```

3 minutes consécutives de check en échec → reboot (évite le flapping et les faux
positifs pendant le boot).

**Vérification :**
```bash
aws cloudwatch describe-alarms --region eu-west-1 \
  --alarm-names "pongbros-ws-instance-impaired-reboot" \
  --query "MetricAlarms[].{Name:AlarmName,State:StateValue,Actions:AlarmActions}" --output table
```

**Rollback :**
```bash
aws cloudwatch delete-alarms --region eu-west-1 \
  --alarm-names "pongbros-ws-instance-impaired-reboot"
```

---

## Ordre d'exécution recommandé

> Révisé le 2026-07-30 (D27). La version initiale plaçait swap + pm2 en premier en les
> qualifiant de correctifs de la cause — c'était l'inverse de l'ordre utile.

0. **Étape 0 — forensique.** Sans diagnostic, tout le reste est de la spéculation.
1. **Étape 1 — mesurer.** Sur une infra à 3,40 €/mois sans aucune métrique, la première
   dépense utile est l'observabilité, pas la capacité.
2. **Étape 2 — corriger `server.ts`.** Les quatre rétentions sont réelles quelle qu'ait
   été la cause du 19 juillet.
3. **Étape 3 — build hors prod.** Supprime le pic latent de déploiement.
4. **Étape 4 — filets** : Option 1 (swap) + Option 2 (pm2), puis Option 3 (alarme, ~€1/an).

## Vérification globale post-application

```bash
# Depuis le poste : handshake WS doit renvoyer HTTP/1.1 101 Switching Protocols
curl -sS -m 12 -i -N \
  -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" https://ws.odomate.eu/ | head -8
```

Puis recharger https://rvuong.github.io/airpair/ (vider le cache PWA au besoin) :
l'écran hôte doit afficher le QR + le code de room.

## Diagnostic rapide « plus de QR » (pour la prochaine fois)

```bash
aws ec2 describe-instance-status --region eu-west-1 \
  --instance-ids i-00d544c3b5e3ea343 \
  --query "InstanceStatuses[].{State:InstanceState.Name,Sys:SystemStatus.Status,Inst:InstanceStatus.Status}"
```
- `Inst: impaired` → OS figé → `stop` puis `start` (EIP/EBS conservés).
