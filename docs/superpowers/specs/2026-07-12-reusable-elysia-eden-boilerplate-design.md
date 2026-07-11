# Reusable Elysia Eden Boilerplate Design

## Goal

Convert this repository into a reusable, domain-neutral Bun/Turborepo boilerplate. The sole application transport is Elysia under `/api`, consumed by Next.js through Eden Treaty. The template contains no task-management, Sleekflow, authentication, or SSO domain code.

## Scope

This change removes the existing tRPC, Next.js internal API routes, SSO/auth integration, Sleekflow persistence, and task-management-specific documentation. It retains the Bun, Turbo, Next.js, Elysia, Prisma, PostgreSQL, Mantine, and TanStack Query foundations where they support the new architecture.

The web app exposes public pages in `app/(public)` and dashboard pages in `app/(dashboard)`. These are route-group organization boundaries only; authentication is not included in the boilerplate.

## Architecture

### Workspace ownership

- `apps/api` owns the Elysia application, HTTP transport, API validation, API response mapping, request IDs, logging, CORS, and health endpoints.
- `apps/web` owns Next.js routes, UI, and Eden consumers. It never imports Prisma, the database package, or application usecases.
- `packages/database` owns the Prisma schema, migrations, generated client, and the singleton `prisma` client.
- `packages/application` owns write-side usecases and domain rules. It may depend on `@repo/database`, but does not import Elysia or Next.js.
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

`DATABASE_URL` exists only in `.env.api`. The web environment only receives API URL configuration, including `NEXT_PUBLIC_API_URL` for browser-side Eden calls. The server-side web runtime uses a corresponding API URL value where a non-public override is necessary.

## Agent Guidance

The `.agent` directory is replaced with focused Markdown rules:

- `architecture.md`: workspace ownership, permitted dependencies, data flows, and feature workflow.
- `api.md`: Elysia route organization, endpoint contracts, query/mutation boundaries, and error handling.
- `database.md`: Prisma ownership, migrations, client usage, and usecase transaction rules.
- `web.md`: `(public)` and `(dashboard)` routing, Eden-only API access, and client data conventions.

No rule may prescribe tRPC, `/nextapi`, auth/SSO, or a product-specific domain.

## Testing and Verification

- Test usecases as unit tests with focused database dependencies.
- Test Elysia routes through `app.handle` for validation, responses, and failure envelopes.
- Test Eden/client helpers only when they contain behavior beyond direct Eden calls.
- Run `bun test`, `bun run lint`, `bun run check-types`, and `bun run build` before declaring the migration complete.

## Feature Workflow

For each future feature:

1. Add or change the Prisma schema and create a migration.
2. Implement direct Prisma reads in its Elysia query routes.
3. Implement state changes in `@repo/application` usecases.
4. Add Elysia mutation routes that invoke those usecases.
5. Consume the typed routes from Next.js through Eden.
6. Add focused tests at the affected boundary.
