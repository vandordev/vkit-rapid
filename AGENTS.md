# AGENTS.md

Guidelines for Codex and other coding agents working in this repository.

## Start Here

1. Read `README.md` for the public architecture and supported commands.
2. Read the relevant files in `.agent/` before changing API, web, database, config, worker, or scheduler code.
3. Inspect the current worktree with `git status --short`; preserve unrelated user changes.
4. Use existing patterns and keep changes focused on the requested behavior.

## Repository Shape

The default application is `apps/web` + `apps/api`:

- `apps/web`: Next.js App Router, `(public)` and `(dashboard)` route groups, Eden consumers, and the embedded API adapter at `app/api/[[...slugs]]/route.ts`.
- `apps/api`: Elysia app factory, API routes, validation, errors, logging, and standalone Bun entrypoint.
- `packages/database`: Prisma schema, migrations, generated client, and singleton client.
- `packages/application`: mutation usecases and domain rules.
- `packages/config`: typed server runtime configuration.
- UI choice is project-scoped: Mantine is the current default; shadcn/ui is an alternative, not a second baseline.

`apps/worker`, `apps/scheduler`, and `packages/queue` are optional. Keep them when a project needs durable asynchronous jobs; remove or omit them, their env files, Compose services, Dockerfiles, and dependencies when it does not. Do not introduce these runtimes for synchronous features.

## Architecture Rules

### API and Web

- `apps/api/src/app.ts` is the single Elysia app source of truth.
- `apps/api/src/server.ts` may run that app standalone with `app.listen()`.
- `apps/web/app/api/[[...slugs]]/route.ts` is a thin adapter that exports Elysia `app.fetch` for supported HTTP methods.
- Keep application endpoints under `/api`; keep process health endpoints under `/health`.
- Server Components may use `treaty(app).api` directly. Client Components use Eden through the same-origin `/api/*` Route Handler.
- Do not add tRPC, Next.js API proxies, rewrite-based API duplication, or ad-hoc API `fetch` calls in pages/components.

### Reads and Mutations

- Query routes may call Prisma directly to shape a transport-specific read model.
- Mutation routes validate transport input, call a usecase, and map the result to the standard response envelope.
- Usecases own business rules and Prisma transactions; they must not import Elysia or Next.js.
- All business endpoints return `{ success: true, data }` or `{ success: false, error, message, requestId? }`.

### Database

- Only `packages/database` creates or exports the Prisma client.
- Schema changes belong in `packages/database/prisma/schema.prisma` and require a migration.
- Never add a product-specific model to the reusable baseline without an explicit product requirement.
- Keep database access out of `apps/web`.

### Configuration

- Server apps use typed loaders from `@repo/config` and `@t3-oss/env-core`.
- Next.js uses `@t3-oss/env-nextjs` in `apps/web/lib/env.ts`.
- Do not read `process.env` in feature code. Add new keys to the smallest runtime schema that needs them.
- Keep `.env.api`, `.env.web`, and optional `.env.worker`/`.env.scheduler` boundaries intact. Never expose `DATABASE_URL` to the browser.

### UI

- Read `.agent/ui.md` before changing the web design system.
- Use one primary UI system per project. Do not mix Mantine and shadcn primitives as a default.

### Optional Jobs

- If jobs are enabled, `apps/scheduler` only schedules/enqueues named jobs.
- `apps/worker` consumes jobs and invokes application usecases; it owns retries, idempotency, graceful shutdown, and job logging.
- `packages/queue` owns the PostgreSQL queue lifecycle and job contract.
- Schedulers must not import Prisma or usecases. Workers must not contain product business rules.

## Implementation Workflow

1. Write a focused failing test for new or changed behavior.
2. Implement the smallest change that makes the test pass.
3. Keep route, usecase, config, and runtime responsibilities in their owning workspace.
4. Update `.agent/*.md` and README when reusable architecture or commands change.
5. Prefer `task <name>` commands from `Taskfile.yml`; use `task --list` to discover them.
6. Before completion, run the narrow tests first, then `task quality` and `task build` when the change affects shared code or runtime wiring.

## Change Boundaries

- Do not rewrite unrelated files, generated output, lockfiles, or user changes.
- Do not create a second API transport for the same resource.
- Do not add authentication, SSO, or a sample business domain to the baseline unless explicitly requested.
- Do not claim completion without fresh test/typecheck/build evidence.
- Keep commits focused and use a descriptive conventional commit message when committing is requested.
