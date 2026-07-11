# Reusable Application Boilerplate

Domain-neutral Bun/Turborepo boilerplate for projects built with Next.js, Elysia, Eden, Prisma, PostgreSQL, and optional scheduled workers.

## Architecture

```text
PostgreSQL -> Prisma -> Elysia /api -> Eden -> Next.js
PostgreSQL -> Prisma -> usecase -> Elysia /api -> Eden -> Next.js
Scheduler -> PostgreSQL queue -> Worker -> usecase -> Prisma
```

- `apps/api` is the Elysia HTTP boundary. Health is at `/health`; application routes are under `/api`.
- `apps/web` uses `(public)` and `(dashboard)` route groups and consumes the API through Eden.
- `apps/scheduler` enqueues named jobs; `apps/worker` processes them.
- `packages/database` owns Prisma; `packages/application` owns mutation usecases; `packages/config` owns typed server env loaders.
- There is no auth, SSO, tRPC, task-management, or product schema in the baseline.

## Development

```bash
task install
cp .env.api.example .env.api
cp .env.web.example .env.web
cp .env.worker.example .env.worker
cp .env.scheduler.example .env.scheduler
task dev
```

Web: http://localhost:4100  
API: http://localhost:4101  
Health: http://localhost:4101/health

Use `.env.worker` and `.env.scheduler` when those runtimes are enabled. The web app never receives `DATABASE_URL`.

## Commands

Use `task --list` to see the complete command surface. Common commands are `task dev`, `task test`, `task lint`, `task check-types`, `task build`, `task quality`, `task db:generate`, and `task db:migrate:dev`.

Runtime-specific commands include `task dev:api`, `task dev:web`, `task dev:worker`, `task dev:scheduler`, `task test:queue`, `task build:worker`, and `task api:health`.

See `.agent/` for the architecture and feature rules that future projects should follow.
