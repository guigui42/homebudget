# Copilot Instructions for HomeBudget
### Caveman Mode
Terse like caveman. Technical substance exact. Only fluff die.
Drop: articles, filler (just/really/basically), pleasantries, hedging.
Fragments OK. Short synonyms. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].
ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift.
Code/commits/PRs: normal. Off: "stop caveman" / "normal mode".


# Snip - CLI Token Optimizer

When executing shell commands, always prefix them with the snip proxy to reduce token usage.

## Usage

Instead of running commands directly:
```
git status
go test ./...
```

Prefix with snip:
```
snip -- git status
snip -- go test ./...
```

This applies to all shell commands. Snip filters verbose output while preserving errors and essential information.
## Project overview

HomeBudget is a personal finance tracking app. It is a **Bun + Turborepo** monorepo with three workspaces:

| Workspace | Path | Purpose |
|---|---|---|
| `@homebudget/api` | `apps/api` | REST API — Bun, Effect-TS, Drizzle ORM, PostgreSQL |
| `@homebudget/web` | `apps/web` | SPA — React 19, Vite, Mantine UI, Recharts |
| `@homebudget/shared` | `packages/shared` | Shared domain types, schemas, and API contract |

## Tech stack

- **Runtime / package manager:** Bun
- **Monorepo orchestration:** Turborepo
- **Language:** TypeScript (strict mode, `verbatimModuleSyntax`)
- **Backend:** Effect-TS (`effect`, `@effect/platform-bun`, `@effect/sql-pg`, `@effect/sql-drizzle`)
- **Frontend:** React 19, Vite, Mantine 7, react-router-dom 7, Recharts
- **Database:** PostgreSQL 17 (Docker)

## Conventions

### General

- Use **ES modules** (`"type": "module"`) in the workspace packages.
- Prefer `const` and arrow functions. Avoid `class` unless the framework requires it.
- Keep files small and focused — one module per concern.

### Effect-TS (backend)

- Model errors as tagged unions with `Data.TaggedError`.
- Use **services and layers** for dependency injection — never import implementations directly.
- Compose programs with `Effect.gen` (generator style).
- Keep `Effect.runPromise` / `runFork` at the edges only (entry-point).
- Use `Schema` from `effect` for runtime validation and encoding/decoding.

### React (frontend)

- Use **function components** with hooks.
- Co-locate component, styles, and tests in the same directory when practical.
- Prefer Mantine components and hooks over custom UI primitives.
- Lift state only as far as needed; keep components lean.
- Use `react-router-dom` loaders/actions for route-level data fetching when appropriate.

### Shared package

- Domain types and API schemas live in `packages/shared` so both apps import the same contract.
- Export everything from `src/index.ts`.

## Dev workflow

```bash
# Start the database and all dev servers
bun run dev

# Type-check the entire monorepo
bun run typecheck

# Build all packages
bun run build
```

Database runs on `localhost:5435`. Connection string is in `.env.example`.
