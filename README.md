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
bun install --ignore-scripts
cp .env.api.example .env.api
cp .env.web.example .env.web
cp .env.worker.example .env.worker
cp .env.scheduler.example .env.scheduler
bun run dev
```

Web: http://localhost:4100  
API: http://localhost:4101  
Health: http://localhost:4101/health

Use `.env.worker` and `.env.scheduler` when those runtimes are enabled. The web app never receives `DATABASE_URL`.

## Commands

- `bun run dev`, `bun run dev:api`, `bun run dev:web`
- `bun run check-types`, `bun run lint`, `bun test`, `bun run build`
- `bun run db:generate`, `bun run db:migrate:dev`
- `bun run start:worker`, `bun run start:scheduler` when worker runtimes are present

See `.agent/` for the architecture and feature rules that future projects should follow.
