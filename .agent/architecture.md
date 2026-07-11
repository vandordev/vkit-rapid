# Architecture Rules

- `apps/api` is the only HTTP backend and owns Elysia routes under `/api`.
- `apps/web` consumes API contracts through Eden; it never imports Prisma or application usecases.
- `apps/scheduler` enqueues named jobs only. `apps/worker` consumes jobs and invokes `packages/application` usecases.
- `packages/database` owns Prisma schema, migrations, generated client, and the singleton client.
- `packages/application` owns mutation business rules and transactions. It must not import Elysia or Next.js.
- `packages/config` owns typed server runtime configuration. Do not read `process.env` in feature code.
- New features follow: schema -> query/usecase -> Elysia route -> Eden consumer; asynchronous work adds a job contract and worker handler.
