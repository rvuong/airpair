.PHONY: dev build stop

dev:
	@echo "Relay server  ws://localhost:3000"
	@cd server && npm run start > /tmp/airpair-server.log 2>&1 &
	@echo "Vite client   https://localhost:5173"
	@cd src && npm run dev > /tmp/airpair-vite.log 2>&1 &
	@echo "Logs: /tmp/airpair-server.log  /tmp/airpair-vite.log"
	@echo "Stop: make stop"

build:
	@cd src && npm run build

stop:
	@pkill -f "[v]ite --host" 2>/dev/null || true
	@pkill -f "[t]s-node server" 2>/dev/null || true
	@echo "Stack arretee"
