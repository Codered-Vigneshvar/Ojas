#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-ojas}"
DB_NAME="${DB_NAME:-ojas}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
  sleep 1
done
echo "Postgres is ready."

echo "Enabling extensions..."
docker compose exec -T postgres psql "postgresql://${DB_USER}:${DB_PASS:-ojas_dev}@localhost:5432/${DB_NAME}" <<SQL
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL

echo "Extensions enabled."

echo "Running Alembic migrations..."
cd "$(dirname "$0")/../apps/api"
uv run alembic upgrade head

echo "Bootstrap complete. pgvector + pgcrypto enabled, migrations applied."
