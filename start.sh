#!/usr/bin/env bash
# start.sh — starts the Ojas API and web frontend in parallel.
# Usage: ./start.sh

set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
UV="$HOME/.local/bin/uv"

# Colours
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${CYAN}Ojas dev startup${RESET}"
echo "─────────────────────────────────────"

# ── Check Docker is up ────────────────────────────────────────────────────────
if ! docker compose -f "$REPO/docker-compose.yml" ps --status running | grep -q "postgres"; then
  echo -e "${YELLOW}Postgres not running — starting Docker services…${RESET}"
  docker compose -f "$REPO/docker-compose.yml" up -d
  echo "Waiting for Postgres to be ready…"
  sleep 4
fi

# ── Run migrations ────────────────────────────────────────────────────────────
echo -e "${GREEN}▶ Running migrations…${RESET}"
cd "$REPO/apps/api" && $UV run alembic upgrade head

# ── Seed dev data ─────────────────────────────────────────────────────────────
echo -e "${GREEN}▶ Seeding dev data…${RESET}"
cd "$REPO/apps/api" && $UV run python "$REPO/scripts/seed_dev_data.py"

echo "─────────────────────────────────────"
echo -e "${GREEN}▶ Starting API on  http://localhost:8000${RESET}"
echo -e "${GREEN}▶ Starting web on  http://localhost:5173${RESET}"
echo "  Press Ctrl+C to stop both."
echo "─────────────────────────────────────"

# Kill all servers when this script exits
cleanup() {
  echo ""
  echo "Stopping servers…"
  kill "$API_PID" "$WEB_PID" 2>/dev/null
  wait "$API_PID" "$WEB_PID" 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# API — prefix every log line so you can tell them apart
cd "$REPO/apps/api"
$UV run uvicorn ojas.main:app --reload --host 0.0.0.0 --port 8000 2>&1 \
  | sed 's/^/[api] /' &
API_PID=$!

# Web
cd "$REPO/apps/web"
pnpm dev 2>&1 | sed 's/^/[web] /' &
WEB_PID=$!

# Wait for all (Ctrl+C triggers cleanup trap)
wait "$API_PID" "$WEB_PID"
