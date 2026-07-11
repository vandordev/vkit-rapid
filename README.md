# vkit-rapid

Reusable full-stack boilerplate for building multiple TypeScript applications with a consistent backend boundary, typed configuration, and production-ready runtime separation.

vkit-rapid gives every new project the same foundation:

- Next.js for the web experience
- Elysia on Bun for the HTTP API
- Eden for end-to-end API type safety
- Prisma and PostgreSQL for persistence
- Usecases for mutation business rules
- PostgreSQL-backed jobs with separate scheduler and worker processes
- Taskfile as the single developer command surface

The repository is intentionally domain-neutral. Start with the architecture and conventions, then add the product domain you need.

## Why vkit-rapid?

Starting a project repeatedly often means rebuilding the same boundaries: environment validation, API wiring, database access, background jobs, local commands, and deployment files. vkit-rapid packages those decisions into a reusable monorepo so a new product can focus on its domain instead of its plumbing.

The template is designed for teams that want:

- one typed API contract shared by backend and frontend;
- a clear separation between reads, mutations, and asynchronous work;
- independently deployable web, API, scheduler, and worker runtimes;
- configuration that exposes only the environment variables each runtime needs;
- a small, understandable foundation without a sample business domain to remove later.

## Architecture

### Synchronous data flows

Reads pass through Elysia so the web app and future consumers share the same API boundary:

```text
PostgreSQL -> Prisma -> Elysia query route -> Eden -> Next.js
```

State changes pass through an application usecase before reaching the transport layer:

```text
PostgreSQL -> Prisma -> application usecase -> Elysia mutation route -> Eden -> Next.js
```

Query routes may use Prisma directly to shape transport-specific read models. Mutation routes validate input and call usecases. Usecases own business rules and transactions; they do not know about HTTP or Next.js.

### Asynchronous data flow

Scheduling and execution are separate processes. The scheduler only enqueues named jobs. The worker consumes those jobs and invokes application usecases.

```text
Scheduler -> PostgreSQL queue -> Worker -> usecase -> Prisma -> PostgreSQL
```

The queue boundary uses `pg-boss` on PostgreSQL, so durable jobs, retries, delayed execution, and job state do not require an additional Redis service.

## What's Included?

| Workspace              | Responsibility                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/web`             | Next.js App Router, `(public)` and `(dashboard)` route groups, Eden consumers                             |
| `apps/api`             | Elysia app factory, standalone HTTP entrypoint, `/api` routes, health checks, validation, errors, logging |
| `apps/scheduler`       | Time-based job scheduling and enqueueing                                                                  |
| `apps/worker`          | Job consumption, retries, idempotency, and usecase execution                                              |
| `packages/database`    | Prisma schema, migrations, generated client, singleton client                                             |
| `packages/application` | Mutation usecases and domain rules                                                                        |
| `packages/config`      | Typed server configuration with `@t3-oss/env-core`                                                        |
| `packages/queue`       | PostgreSQL queue lifecycle and named job boundary                                                         |
| `.agent`               | Architecture and contribution rules for future work                                                       |

## Quick Start

### Prerequisites

- Bun 1.1 or newer
- Task (`go-task`)
- PostgreSQL for database-backed features
- Docker and Docker Compose for the containerized stack

### Local development

```bash
git clone <repository-url>
cd vkit-rapid

task install
cp .env.api.example .env.api
cp .env.web.example .env.web
cp .env.worker.example .env.worker
cp .env.scheduler.example .env.scheduler

task dev
```

The local services use these endpoints:

- Web: http://localhost:4100
- API: http://localhost:4101
- API health: http://localhost:4101/health
- API status: http://localhost:4101/api/status

The web runtime owns the public origin used by Eden. `DATABASE_URL` belongs to the server runtimes and is never exposed to the browser.

### Containerized development

After creating the environment files, run the web, embedded Elysia, worker, and scheduler stack with:

```bash
task compose:up
```

Use `task compose:up:detached`, `task compose:logs`, `task compose:ps`, and `task compose:down` to manage the stack.

## Command Reference

Taskfile is the supported interface for project operations. Run `task --list` for the complete list.

```text
task dev                  Run web, API, worker, and scheduler
task start                Start all built runtimes
task build                Type-check and build every runtime
task quality              Run tests, lint, and typechecks
task test                 Run every test
task lint                 Lint every workspace
task check-types         Type-check every workspace
task format              Format source and documentation
task db:generate         Generate the Prisma client
task db:migrate:dev      Create and apply a development migration
task db:studio           Open Prisma Studio
task api:health          Check the API health endpoint
task api:status          Check the API status endpoint
```

Runtime-specific commands follow the same naming pattern:

```text
task dev:api             Run only the API
task dev:web             Run only the web app
task dev:worker          Run only the worker
task dev:scheduler       Run only the scheduler
task test:queue          Test the queue boundary
task build:worker        Build the worker
task check-types:web     Type-check the web app
```

## Building a Feature

Use this sequence when adding a product feature:

1. Add the domain model to `packages/database/prisma/schema.prisma` and create a migration.
2. Add direct Prisma read queries to the owning Elysia query route.
3. Put state-changing rules in a usecase under `packages/application`.
4. Add an Elysia mutation route that validates input and invokes the usecase.
5. Consume the typed endpoint from Next.js through `apps/web/lib/api` and Eden.
6. If work is asynchronous, define a named job, add a worker handler, and add a scheduler only when a time-based trigger is needed.
7. Add focused tests at the boundary you changed.

This keeps business rules reusable across HTTP requests, scheduled jobs, and worker execution.

## Project Structure

```text
apps/
  api/          Elysia app factory and standalone HTTP entrypoint
  web/          Next.js application
  scheduler/    enqueue-only scheduler process
  worker/       asynchronous job process
packages/
  application/  mutation usecases
  config/       typed runtime configuration
  database/     Prisma schema and client
  queue/        PostgreSQL queue boundary
.agent/         architecture rules
Taskfile.yml    project command surface
```

## Design Principles

- **One HTTP boundary:** Elysia owns application API routes under `/api`, embedded into Next.js through a catch-all Route Handler.
- **One frontend transport:** Next.js uses Eden and a thin Elysia Route Handler adapter; there is no tRPC or duplicate API proxy.
- **Explicit mutation boundary:** state changes go through application usecases.
- **Independent runtimes:** web, API, scheduler, and worker can be deployed and scaled separately.
- **Scoped configuration:** each runtime validates only the environment variables it needs.
- **Domain-neutral baseline:** no authentication, SSO, task-management, or product-specific schema is included.
- **Operational clarity:** tests, linting, typechecking, builds, database tasks, and Compose workflows are exposed through Taskfile.

## Contributing

Before opening a change, read the applicable files in `.agent/`. Run the focused task for the workspace you changed, then run:

```bash
task quality
task build
```

Keep new feature code within the ownership boundaries above and update the relevant `.agent` rule when the reusable architecture changes.
