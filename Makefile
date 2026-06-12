.PHONY: help start build stop status
.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "  AirPair — commandes disponibles"
	@echo ""
	@echo "  make start    🚀  Démarre le serveur relay + client Vite"
	@echo "  make stop     🛑  Arrête les processus en arrière-plan"
	@echo "  make status   📡  Vérifie si les processus tournent"
	@echo "  make build    📦  Build de production (Vite)"
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
