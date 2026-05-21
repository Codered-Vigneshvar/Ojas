.PHONY: up down logs api web migrate migration test lint format seed reset

# Docker
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

# Dev servers
api:
	cd apps/api && uv run uvicorn ojas.main:app --reload --host 0.0.0.0 --port 8000

web:
	cd apps/web && pnpm dev

# Database
migrate:
	cd apps/api && uv run alembic upgrade head

migration:
	cd apps/api && uv run alembic revision --autogenerate -m "$(name)"

# Testing
test:
	cd apps/api && uv run pytest

# Linting & formatting
lint:
	cd apps/api && uv run ruff check . && uv run mypy src/
	cd apps/web && pnpm eslint src/

format:
	cd apps/api && uv run ruff format .
	cd apps/web && pnpm prettier --write src/

# Data
seed:
	cd apps/api && ~/.local/bin/uv run python ../../scripts/seed_dev_data.py

reset:
	bash scripts/reset_local.sh
