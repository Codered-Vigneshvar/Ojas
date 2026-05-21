#!/usr/bin/env bash
set -euo pipefail

echo "Resetting local environment..."

# Bring down containers and remove volumes
docker compose down -v

# Restart fresh
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 8

# Re-bootstrap DB
bash "$(dirname "$0")/bootstrap_db.sh"

# Re-seed
cd "$(dirname "$0")/../apps/api"
uv run python ../../scripts/seed_dev_data.py

echo "Local environment reset complete."
