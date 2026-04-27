# HomeBudget2

Personal salary allocation visualizer — see where your money goes across houses and currencies via a Sankey diagram.

## Quick Start (development)

```bash
# Start PostgreSQL
docker compose up -d db

# Install dependencies
bun install

# Start API (port 3210)
cd apps/api && bun run dev

# Start frontend (port 5173, proxies /api → 3210)
cd apps/web && bun run dev
```

## Self-Hosting (production)

```bash
docker compose up -d --build
# Open http://localhost:8080
```

`docker compose` now runs a single `app` container plus PostgreSQL. The same root image is used locally and by the GHCR publish workflow.

## Single Image Build

```bash
docker build -t ghcr.io/guigui42/homebudget .
docker run --rm -p 8080:80 \
	-e DATABASE_URL=postgres://homebudget:homebudget@host.docker.internal:5432/homebudget \
	ghcr.io/guigui42/homebudget
```

The root Dockerfile packages the API and web app into one container. The GitHub Actions workflow in `.github/workflows/docker-publish.yml` uses Docker Buildx to publish that image to GHCR on pushes to `main`, `master`, and version tags.

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + Bun workspaces |
| Backend | Effect + @effect/platform-bun + @effect/sql-pg |
| Frontend | React 19 + Mantine v7 + Recharts |
| Database | PostgreSQL 17 |
| Shared API | @effect/platform HttpApi (type-safe, defined once) |

## Architecture

```
apps/api/        → Bun HTTP server (Effect)
apps/web/        → React SPA (Vite)
packages/shared/ → Effect Schema + HttpApi definition
```

Key concept: **not** a transaction tracker. You define your salary and recurring expenses with prices that change over time. The app shows:

- **Sankey diagram**: salary → locations → expense groups → individual expenses → savings
- **Price evolution**: how costs change over time
- **Exchange rate tracking**: EUR/PHP via ECB data

## Database Reset

```bash
docker compose down -v   # removes volume
docker compose up -d db  # recreates with schema
```

To rebuild the full app container after changes:

```bash
docker compose up -d --build app
```
