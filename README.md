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
