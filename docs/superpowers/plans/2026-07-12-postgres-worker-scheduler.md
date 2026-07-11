# PostgreSQL Worker and Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add separately deployable scheduler and worker apps that use `pg-boss` with PostgreSQL, while keeping all business mutations in application usecases.

**Architecture:** `packages/queue` owns the `pg-boss` lifecycle and typed job registry. The scheduler can only enqueue registered job names; the worker binds registered handlers that call `@repo/application`. Neither process owns Prisma business logic, and future API routes can enqueue the same named jobs.

**Tech Stack:** Bun, TypeScript, PostgreSQL, pg-boss, Prisma, `@t3-oss/env-core`, Bun test, Docker Compose.

---

## File Structure

- Create: `packages/queue/package.json`, `packages/queue/tsconfig.json`, `packages/queue/src/client.ts`, `packages/queue/src/jobs.ts`, `packages/queue/src/index.ts`, and focused tests.
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/main.ts`, `apps/worker/src/handlers.ts`, and tests.
- Create: `apps/scheduler/package.json`, `apps/scheduler/tsconfig.json`, `apps/scheduler/src/main.ts`, `apps/scheduler/src/schedules.ts`, and tests.
- Create: `.env.worker.example`, `.env.scheduler.example`, `Dockerfile.worker`, `Dockerfile.scheduler`.
- Modify: root `package.json`, `turbo.json`, `Taskfile.yml`, `docker-compose.yml`, README, `.gitignore`, `.agent/worker.md`, `.agent/scheduler.md`, `.agent/config.md`.

### Task 1: Add queue package and durable job contracts

**Files:** Create `packages/queue/**` and tests.

- [ ] **Step 1: Write a failing job-registry test**

```ts
import { expect, test } from "bun:test";
import { jobNames } from "./jobs";

test("starts with no product-domain job names", () => {
  expect(jobNames).toEqual([]);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `rtk bun test packages/queue/src/jobs.test.ts`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement queue boundary**

First create `packages/queue/package.json` with `{ "name": "@repo/queue", "version": "0.1.0", "private": true, "type": "module" }` and the TypeScript config. Then run: `rtk bun add --cwd packages/queue pg-boss`

Implement `createQueue(databaseUrl)` using `new PgBoss(databaseUrl)`, `start()`, and an idempotent `stop()`. Export a `QueueClient` interface with `start`, `stop`, `send`, and `work`; keep `jobNames` as `[] as const` and make scheduler/worker reject unknown names at startup. Do not put a product job in the boilerplate.

- [ ] **Step 4: Verify focused queue tests**

Run: `rtk bun test packages/queue/src/jobs.test.ts && rtk bun run check-types --filter=@repo/queue`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/queue package.json bun.lock
rtk git commit -m "feat(queue): add PostgreSQL job queue boundary"
```

### Task 2: Add the worker process

**Files:** Create `apps/worker/**`; modify config and package manifests.

- [ ] **Step 1: Write failing worker registration test**

```ts
import { expect, test } from "bun:test";
import { registerHandlers } from "./handlers";

test("registers no domain handlers in the generic baseline", async () => {
  const registered: string[] = [];
  await registerHandlers({ work: async (name: string) => { registered.push(name); } } as never);
  expect(registered).toEqual([]);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `rtk bun test apps/worker/src/handlers.test.ts`

Expected: FAIL because worker handlers do not exist.

- [ ] **Step 3: Implement worker lifecycle**

Create a workspace package `@repo/worker` depending on `@repo/config`, `@repo/queue`, and `@repo/application`. `main.ts` loads `createWorkerConfig(process.env)`, starts the queue, calls `registerHandlers`, logs readiness, and on SIGINT/SIGTERM waits for `queue.stop()` before exit. `handlers.ts` contains no handler at baseline and is the only file future features extend to connect a named queue job to an application usecase.

- [ ] **Step 4: Verify worker test and types**

Run: `rtk bun test apps/worker/src/handlers.test.ts && rtk bun run check-types --filter=@repo/worker`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/worker packages/config package.json bun.lock
rtk git commit -m "feat(worker): add queue consumer runtime"
```

### Task 3: Add the scheduler process

**Files:** Create `apps/scheduler/**`; modify config and manifests.

- [ ] **Step 1: Write a failing scheduler test**

```ts
import { expect, test } from "bun:test";
import { registerSchedules } from "./schedules";

test("registers no product schedules in the generic baseline", async () => {
  const scheduled: string[] = [];
  await registerSchedules({ schedule: async (name: string) => { scheduled.push(name); } } as never);
  expect(scheduled).toEqual([]);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `rtk bun test apps/scheduler/src/schedules.test.ts`

Expected: FAIL because scheduler files do not exist.

- [ ] **Step 3: Implement enqueue-only scheduler lifecycle**

Create `@repo/scheduler` using `@repo/config` and `@repo/queue`. `main.ts` starts the queue and invokes `registerSchedules`; `schedules.ts` exports only an empty registration function. For future jobs, it may call the pg-boss schedule/enqueue API but must never import Prisma or application usecases. Add graceful SIGINT/SIGTERM shutdown matching the worker.

- [ ] **Step 4: Verify scheduler isolation**

Run: `rtk bun test apps/scheduler/src/schedules.test.ts && rtk rg -n "@repo/(database|application)" apps/scheduler && rtk bun run check-types --filter=@repo/scheduler`

Expected: test and typecheck pass; `rg` prints no imports.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/scheduler packages/config package.json bun.lock
rtk git commit -m "feat(scheduler): add enqueue-only runtime"
```

### Task 4: Add deployment and operator support

**Files:** env templates, Dockerfiles, Compose, Taskfile, README, agent rules.

- [ ] **Step 1: Write failing command-presence tests**

Create a Bun test that reads root `package.json` and asserts `dev:worker`, `dev:scheduler`, `start:worker`, and `start:scheduler` exist; read Compose YAML and assert services `worker` and `scheduler` use their own `env_file`.

- [ ] **Step 2: Run test and verify failure**

Run: `rtk bun test scripts/runtime-layout.test.ts`

Expected: FAIL because commands and services are absent.

- [ ] **Step 3: Implement runtime operations**

Add root scripts and Taskfile targets for all four apps. Add Dockerfiles that install all workspace manifests, build only the targeted app, and run its compiled entrypoint. Compose services use `.env.worker` and `.env.scheduler`, depend on the database service or documented external database health, and do not expose HTTP ports. Env templates include `NODE_ENV` and `DATABASE_URL` only until a feature introduces additional job settings. Update README and agent rules with job naming, retry/idempotency ownership, and scheduler enqueue-only constraints.

- [ ] **Step 4: Run full verification**

Run: `rtk bun test && rtk bun run lint && rtk bun run check-types && rtk bun run build`

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
rtk git add Dockerfile.worker Dockerfile.scheduler docker-compose.yml Taskfile.yml README.md .agent .env.worker.example .env.scheduler.example .gitignore package.json turbo.json scripts
rtk git commit -m "chore: add worker and scheduler operations"
```
