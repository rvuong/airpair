#!/usr/bin/env bash
# Idempotent host hardening for the AirPair WS server (EC2 t4g.nano, 512 MB RAM).
# Run as root on the instance. Executed on every server deploy (deploy-server.yml).
# Context: docs/decisions.md D11 — "Incidents OOM et durcissement".
set -euo pipefail

log() { echo "[harden] $*"; }

# 1. Remove the memory hogs that froze the instance (fwupd OOM loop, snapd watchdog).
#    Firmware updates are meaningless on a virtual machine; snaps are unused.
for unit in fwupd.service fwupd-refresh.service fwupd-refresh.timer \
            snapd.service snapd.socket snapd.seeded.service; do
  if systemctl list-unit-files "$unit" >/dev/null 2>&1; then
    systemctl disable --now "$unit" >/dev/null 2>&1 || true
    systemctl mask "$unit" >/dev/null 2>&1 || true
  fi
done
log "fwupd/snapd masked"

# 2. 1 GB swap: absorbs memory spikes (npm ci + tsc during deploys, apt) instead of OOM.
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-airpair-swap.conf
sysctl -q -p /etc/sysctl.d/99-airpair-swap.conf
log "swap active: $(swapon --show=SIZE --noheadings | head -1)"

# 3. Let the kernel kill a runaway process early rather than thrash until the OS hangs.
if ! command -v earlyoom >/dev/null 2>&1; then
  # A freeze can interrupt unattended-upgrades mid-install: finish it first.
  # Lock timeout covers unattended-upgrades running right after boot.
  export DEBIAN_FRONTEND=noninteractive
  dpkg --configure -a --force-confdef --force-confold
  apt-get -o DPkg::Lock::Timeout=300 update -qq
  apt-get -o DPkg::Lock::Timeout=300 install -y -qq earlyoom >/dev/null
fi
cat > /etc/default/earlyoom <<'EOF'
EARLYOOM_ARGS="-m 5 -s 10 --avoid '(^|/)(nginx|sshd|systemd)$' -r 3600"
EOF
systemctl enable --now earlyoom >/dev/null 2>&1
systemctl restart earlyoom
log "earlyoom enabled"

# 4. TLS: renew now if needed, reload nginx on every future renewal, keep the timer on.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
if systemctl list-unit-files certbot.timer >/dev/null 2>&1; then
  systemctl enable --now certbot.timer >/dev/null 2>&1
fi
certbot renew --quiet --deploy-hook "systemctl reload nginx"
log "certificate: $(certbot certificates 2>/dev/null | grep -m1 'Expiry Date' | sed 's/^ *//')"

# 5. pm2 must come back after any reboot (alarm-triggered reboots rely on it).
#    PM2_BIN is passed by the deploy workflow (pm2 lives in the ubuntu user's PATH).
if ! systemctl is-enabled pm2-ubuntu >/dev/null 2>&1; then
  if [ -n "${PM2_BIN:-}" ] && [ -x "$PM2_BIN" ]; then
    env PATH="$PATH:$(dirname "$PM2_BIN")" "$PM2_BIN" startup systemd -u ubuntu --hp /home/ubuntu >/dev/null
  else
    log "WARNING: pm2-ubuntu not enabled and PM2_BIN not set — server will not restart after reboot"
  fi
fi
log "pm2 startup: $(systemctl is-enabled pm2-ubuntu 2>/dev/null || echo disabled)"

log "memory: $(free -m | awk '/Mem:/ {print $3"/"$2" MB used"}')"
