# Architecture Rules

- `apps/api` owns the Elysia app and routes under `/api`; `apps/web/app/api/[[...slugs]]/route.ts` embeds that app for the semi-monolith deployment.
- `apps/web` consumes API contracts through Eden; it never imports Prisma or application usecases.
- `apps/scheduler` and `apps/worker` are optional; when enabled, the scheduler enqueues named jobs and the worker invokes `packages/application` usecases.
- `packages/database` owns Prisma schema, migrations, generated client, and the singleton client.
- `packages/application` owns mutation business rules and transactions. It must not import Elysia or Next.js.
- `packages/config` owns typed server runtime configuration. Do not read `process.env` in feature code.
- `apps/api/src/server.ts` remains the standalone Bun entrypoint when a separate API deployment is needed.
- New features follow: schema -> query/usecase -> Elysia route -> Eden consumer; asynchronous work adds a job contract and worker handler.
