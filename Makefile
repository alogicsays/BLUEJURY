.PHONY: backend-dev frontend-dev test lint typecheck db-up db-down db-migrate

backend-dev:
	services/api/.venv/bin/uvicorn bluejury.main:app --reload --app-dir services/api/src

frontend-dev:
	npm --prefix apps/web run dev

test:
	services/api/.venv/bin/pytest services/api/tests
	npm --prefix apps/web run test -- --run

lint:
	services/api/.venv/bin/ruff check services/api/src services/api/tests
	npm --prefix apps/web run lint

typecheck:
	services/api/.venv/bin/mypy services/api/src
	npm --prefix apps/web run typecheck

db-up:
	docker compose up -d db

db-down:
	docker compose down

db-migrate:
	services/api/.venv/bin/alembic -c services/api/alembic.ini upgrade head

