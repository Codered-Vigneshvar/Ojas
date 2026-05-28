#!/usr/bin/env bash
# Ojas Demo — one-command startup for Mac / Linux
# Usage: ./start.sh

set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
VENV="$REPO/venv"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "${CYAN}"
echo "  ___       _           "
echo " / _ \     (_)          "
echo "| | | |     _ __ _ ___  "
echo "| | | |    | |/ _\` / __| "
echo "| |_| | _  | | (_| \__ \\"
echo " \___/ (_) | |\__,_|___/ "
echo "         _/ |            "
echo "        |__/             "
echo -e "${RESET}"
echo -e "${CYAN}Ojas Clinical Demo — starting up${RESET}"
echo "──────────────────────────────────────"

# ── Check .env ────────────────────────────────────────────────────────────────
if [ ! -f "$REPO/backend/.env" ]; then
  echo -e "${RED}ERROR: backend/.env not found.${RESET}"
  echo "Copy the example and fill in your API keys:"
  echo "  cp backend/.env.example backend/.env"
  exit 1
fi

# ── Python venv ───────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo -e "${YELLOW}▶ Creating Python virtual environment...${RESET}"
  python3.11 -m venv "$VENV" || python3 -m venv "$VENV"
fi

echo -e "${GREEN}▶ Installing backend dependencies...${RESET}"
"$VENV/bin/pip" install -q -r "$REPO/backend/requirements.txt"

# ── Database setup ────────────────────────────────────────────────────────────
echo -e "${GREEN}▶ Initialising database tables...${RESET}"
cd "$REPO/backend" && "$VENV/bin/python" init_db.py

echo -e "${GREEN}▶ Seeding user account...${RESET}"
cd "$REPO/backend" && "$VENV/bin/python" seed_users.py

# ── Frontend deps ─────────────────────────────────────────────────────────────
echo -e "${GREEN}▶ Installing frontend dependencies...${RESET}"
cd "$REPO/frontend" && npm install --silent

echo ""
echo "──────────────────────────────────────"
echo -e "${GREEN}▶ Backend  →  http://localhost:8001${RESET}"
echo -e "${GREEN}▶ Frontend →  http://localhost:5173${RESET}"
echo "  Press Ctrl+C to stop both."
echo "──────────────────────────────────────"
echo ""

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

# ── Start backend ─────────────────────────────────────────────────────────────
cd "$REPO/backend"
"$VENV/bin/uvicorn" main:app --reload --port 8001 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

# ── Start frontend ────────────────────────────────────────────────────────────
cd "$REPO/frontend"
npm run dev 2>&1 | sed 's/^/[frontend] /' &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
