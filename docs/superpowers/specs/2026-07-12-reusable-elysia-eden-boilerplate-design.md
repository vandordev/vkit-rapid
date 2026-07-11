# Reusable Elysia Eden Boilerplate Design

## Goal

Convert this repository into a reusable, domain-neutral Bun/Turborepo boilerplate. Its runtime apps are the Elysia API, Next.js web app, scheduler, and worker. The sole application HTTP transport is Elysia under `/api`, consumed by Next.js through Eden Treaty. The template contains no task-management, Sleekflow, authentication, or SSO domain code.

## Scope

This change removes the existing tRPC, Next.js internal API routes, SSO/auth integration, Sleekflow persistence, and task-management-specific documentation. It retains the Bun, Turbo, Next.js, Elysia, Prisma, PostgreSQL, Mantine, and TanStack Query foundations where they support the new architecture. A PostgreSQL-backed queue is included as the default asynchronous-processing foundation.

The web app exposes public pages in `app/(public)` and dashboard pages in `app/(dashboard)`. These are route-group organization boundaries only; authentication is not included in the boilerplate.

## Architecture

### Workspace ownership

- `apps/api` owns the Elysia application, HTTP transport, API validation, API response mapping, request IDs, logging, CORS, and health endpoints.
- `apps/web` owns Next.js routes, UI, and Eden consumers. It never imports Prisma, the database package, or application usecases.
- `apps/scheduler` owns time-based scheduling. It enqueues named jobs but does not execute business logic.
- `apps/worker` owns asynchronous job consumption. It invokes application usecases and owns worker retry, idempotency, and job-execution logging concerns.
- `packages/database` owns the Prisma schema, migrations, generated client, and the singleton `prisma` client.
- `packages/application` owns write-side usecases and domain rules. It may depend on `@repo/database`, but does not import Elysia or Next.js.
- `packages/config` owns shared server configuration schemas and typed config loaders for non-Next runtimes.
- `.agent` owns durable contributor and agent guidance. Its documents are the source of truth for this template's architecture.

### API and Eden

All business endpoints live in Elysia beneath `/api`. `/health` and `/health/ready` remain operational endpoints outside that namespace.

`apps/api/src/index.ts` exports both `app` and `type App = typeof app`. The server runtime is separate, so importing `App` into the web app does not listen on a port.

`apps/web/lib/api` creates typed Eden clients from `App`. Both Server Components and Client Components call Elysia directly, using an API base URL supplied by environment configuration. Next.js does not proxy API traffic through Route Handlers. TanStack Query may wrap the Eden client for client-side caching, invalidation, and mutation state.

### Data flows

Read paths are intentionally thin:

```text
PostgreSQL -> Prisma -> Elysia query route -> Eden -> Next.js
```

An Elysia query route may read Prisma directly and shape a response for that endpoint. Query logic does not pass through `@repo/application`.

Write paths preserve a usecase boundary:

```text
PostgreSQL -> Prisma -> application usecase -> Elysia mutation route -> Eden -> Next.js
```

Mutation routes validate transport input, invoke a usecase, and map the outcome to HTTP. Usecases contain business rules and Prisma transactions. Usecases do not know HTTP request or response types.

### Scheduled and asynchronous work

The boilerplate uses a PostgreSQL-backed queue, with `pg-boss` as the default implementation. It avoids a Redis dependency while retaining durable jobs, retries, delayed execution, and job state in PostgreSQL.

The scheduler and worker are distinct deployable processes:

```text
Scheduler -> enqueue named job -> PostgreSQL queue -> Worker -> application usecase -> Prisma -> PostgreSQL
```

The scheduler contains schedules, job names, and enqueue options only. It never performs business mutations itself. The worker maps each registered job name to a handler, invokes the relevant usecase, and owns retry policy, idempotency protection, and structured execution logs. API mutation routes may enqueue the same named jobs when asynchronous work follows an HTTP mutation.

## API Contract and Failures

Every business endpoint returns one response envelope:

```ts
type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = {
  success: false;
  error: string;
  message: string;
  requestId?: string;
};
```

Elysia route schemas define request and response contracts. A central error handler maps validation failures, known domain/usecase errors, not-found errors, and unknown failures into the failure envelope. It returns the request ID when available and keeps sensitive internal error details out of production responses.

## Database Baseline

The current Sleekflow models, repository, and migrations are removed. `packages/database` starts with an empty Prisma schema configured for PostgreSQL and a Prisma client wrapper. Future products add models and migrations as part of their own feature work; no task-management example model is retained.

## Web Baseline

The existing auth callbacks, backend proxy, tRPC route, tRPC server modules, tRPC provider, and tRPC dependencies are removed. The root layout uses a general data-client provider where needed, not a tRPC provider. Public and dashboard pages are simple non-authenticated shells that establish route-group conventions without imposing a product domain.

## Configuration

Configuration is typed and scoped to its runtime. No application code reads `process.env` outside a dedicated config module.

`packages/config` uses `@t3-oss/env-core` and contains a shared server schema plus named config loaders:

- `createApiConfig`: common server keys, API port, and CORS configuration.
- `createWorkerConfig`: common server keys and queue/worker configuration.
- `createSchedulerConfig`: common server keys and queue/schedule configuration.

The common schema includes `NODE_ENV` and `DATABASE_URL`. API, worker, and scheduler receive individual environment files, so a process only receives values relevant to its runtime.

Next.js owns `apps/web/lib/env.ts` and uses `@t3-oss/env-nextjs`. It validates server-only values and `NEXT_PUBLIC_*` client values according to Next.js build rules. The web app receives API URL configuration only, including `NEXT_PUBLIC_API_URL` for browser-side Eden calls and an optional server-side internal API URL for Server Components; it never receives `DATABASE_URL`.

Tracked templates are `.env.api.example`, `.env.web.example`, `.env.worker.example`, and `.env.scheduler.example`. Their real counterparts remain ignored by Git.

## Agent Guidance

The `.agent` directory is replaced with focused Markdown rules:

- `architecture.md`: workspace ownership, permitted dependencies, data flows, and feature workflow.
- `api.md`: Elysia route organization, endpoint contracts, query/mutation boundaries, and error handling.
- `database.md`: Prisma ownership, migrations, client usage, and usecase transaction rules.
- `web.md`: `(public)` and `(dashboard)` routing, Eden-only API access, and client data conventions.
- `worker.md`: job registration, handler responsibilities, retries, idempotency, and usecase-only mutation execution.
- `scheduler.md`: schedule ownership and enqueue-only scheduling rules.
- `config.md`: typed config ownership, per-runtime environment boundaries, and T3 Env rules.

No rule may prescribe tRPC, `/nextapi`, auth/SSO, or a product-specific domain.

## Testing and Verification

- Test usecases as unit tests with focused database dependencies.
- Test Elysia routes through `app.handle` for validation, responses, and failure envelopes.
- Test job handlers and scheduler registration with a test queue boundary; assert that scheduler code enqueues work instead of executing usecases.
- Test Eden/client helpers only when they contain behavior beyond direct Eden calls.
- Run `bun test`, `bun run lint`, `bun run check-types`, and `bun run build` before declaring the migration complete.

## Feature Workflow

For each future feature:

1. Add or change the Prisma schema and create a migration.
2. Implement direct Prisma reads in its Elysia query routes.
3. Implement state changes in `@repo/application` usecases.
4. Add Elysia mutation routes that invoke those usecases.
5. When asynchronous work is needed, define a named job and worker handler that invokes the same usecase; add a scheduler registration only when it has a time-based trigger.
6. Consume the typed routes from Next.js through Eden.
7. Add focused tests at the affected boundary.
