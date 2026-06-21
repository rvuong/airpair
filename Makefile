.PHONY: help start build stop status server-restart server-status server-logs
.DEFAULT_GOAL := help

EC2_HOST ?= ws.odomate.eu
EC2_USER ?= ubuntu
EC2_KEY  ?= ~/projects/personal/lumene/odomate-key.pem

help:
	@echo ""
	@echo "  AirPair — commandes disponibles"
	@echo ""
	@echo "  make start           Démarre le serveur relay + client Vite (local)"
	@echo "  make stop            Arrête les processus locaux en arrière-plan"
	@echo "  make status          Vérifie si les processus locaux tournent"
	@echo "  make build           Build de production (Vite)"
	@echo ""
	@echo "  make server-restart  Redémarre le serveur pm2 sur l'EC2"
	@echo "  make server-status   Affiche l'état pm2 sur l'EC2"
	@echo "  make server-logs     Tail des logs pm2 sur l'EC2"
	@echo ""
	@echo "  Variables EC2 (override possible) :"
	@echo "    EC2_HOST=$(EC2_HOST)  EC2_USER=$(EC2_USER)  EC2_KEY=$(EC2_KEY)"
	@echo ""

start:
	@echo ""
	@echo "  Relay server  ws://localhost:3000"
	@cd server && npm run start > /tmp/airpair-server.log 2>&1 &
	@echo "  Vite client   http://localhost:5173"
	@cd src && npm run dev > /tmp/airpair-vite.log 2>&1 &
	@echo ""
	@echo "  Logs : /tmp/airpair-server.log"
	@echo "         /tmp/airpair-vite.log"
	@echo "  Stop : make stop"
	@echo ""

build:
	@cd src && npm run build

stop:
	@pkill -f "[v]ite --host" 2>/dev/null || true
	@pkill -f "[t]s-node server" 2>/dev/null || true
	@echo "  🛑  Stack arrêtée."

status:
	@echo ""
	@pgrep -f "[v]ite --host" > /dev/null && echo "  ✅  Vite        en cours" || echo "  ❌  Vite        arrêté"
	@pgrep -f "[t]s-node server" > /dev/null && echo "  ✅  Relay       en cours" || echo "  ❌  Relay       arrêté"
	@echo ""

server-restart:
	@echo "  Redémarrage airpair-server sur $(EC2_USER)@$(EC2_HOST)…"
	@ssh -i $(EC2_KEY) -o StrictHostKeyChecking=no $(EC2_USER)@$(EC2_HOST) "pm2 restart airpair-server && pm2 status airpair-server"

server-status:
	@ssh -i $(EC2_KEY) -o StrictHostKeyChecking=no $(EC2_USER)@$(EC2_HOST) "pm2 status airpair-server"

server-logs:
	@ssh -i $(EC2_KEY) -o StrictHostKeyChecking=no $(EC2_USER)@$(EC2_HOST) "pm2 logs airpair-server --lines 50"
