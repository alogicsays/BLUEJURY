# BLUEJURY AI V2

Explainable multi-agent marine decision intelligence for fishers. Phase 1 contains production-oriented scaffolding and contracts only; no marine providers, environmental values, candidates, or decisions are fabricated.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker with Compose

## Setup

```bash
npm --prefix apps/web install
python3 -m venv services/api/.venv
services/api/.venv/bin/pip install -e 'services/api[dev]'
cp .env.example .env
```

## Commands

```bash
make db-up
make db-migrate
make backend-dev
make frontend-dev
make test
make lint
make typecheck
```

The web app runs at `http://localhost:3000` and the API at `http://localhost:8000`.

