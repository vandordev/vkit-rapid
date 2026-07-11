# Reusable Elysia Eden Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tRPC/SSO/Sleekflow starter with a domain-neutral Elysia `/api` and Eden-powered Next.js foundation, with typed configuration scoped to each runtime.

**Architecture:** `apps/api` is the single HTTP boundary and exports its Elysia type as workspace package `@repo/api`. `apps/web` consumes that type through Eden and never accesses Prisma. `packages/config` owns server runtime configuration using `@t3-oss/env-core`, while the web app validates its own Next.js environment using `@t3-oss/env-nextjs`.

**Tech Stack:** Bun workspaces, Turborepo, TypeScript, Elysia, `@elysia/eden`, Next.js App Router, Mantine, Prisma, PostgreSQL, Zod, T3 Env, Bun test.

---

## File Structure

- Create: `packages/config/package.json`, `packages/config/tsconfig.json`, `packages/config/src/common.ts`, `packages/config/src/api.ts`, `packages/config/src/worker.ts`, `packages/config/src/scheduler.ts`, `packages/config/src/index.ts`.
- Create: `apps/web/lib/env.ts`, `apps/web/lib/api/client.ts`, `apps/web/components/query-provider.tsx`, `apps/web/app/(public)/page.tsx`, `apps/web/app/(dashboard)/dashboard/page.tsx`.
- Modify: root `package.json`, `turbo.json`, `.gitignore`, `.env.api.example`, `.env.web.example`, `docker-compose.yml`, `Taskfile.yml`, `README.md`.
- Modify: `apps/api/package.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/lib/env.ts`, `apps/api/src/index.ts`, `apps/api/src/app.test.ts`.
- Modify: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css`.
- Delete: all `apps/web/app/nextapi/**`, `apps/web/app/callback/**`, `apps/web/components/trpc-provider.tsx`, `apps/web/server/trpc/**`, `apps/web/lib/auth*.ts`, `apps/web/lib/require-auth*.ts`, `apps/web/lib/sso*.ts`, `apps/web/constants/auth.ts`, `packages/application/src/commands/**`, `packages/database/src/repositories/**`, and current Prisma migrations.
- Modify: `packages/application/src/index.ts`, `packages/application/package.json`, `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts`, and `packages/database/package.json`.

### Task 1: Add the typed configuration package

**Files:** Create the five config source files and tests `packages/config/src/api.test.ts`, `packages/config/src/worker.test.ts`, `packages/config/src/scheduler.test.ts`; modify root `package.json` and `turbo.json`.

- [ ] **Step 1: Write failing config tests**

```ts
import { expect, test } from "bun:test";
import { createApiConfig } from "./api";

test("creates API config from scoped values", () => {
  expect(createApiConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://db", PORT: "4101", CORS_ORIGIN: "http://localhost:4100" })).toMatchObject({ port: 4101, corsOrigin: "http://localhost:4100" });
});

test("rejects an API config without DATABASE_URL", () => {
  expect(() => createApiConfig({ NODE_ENV: "test", PORT: "4101", CORS_ORIGIN: "http://localhost:4100" })).toThrow();
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `rtk bun test packages/config/src/api.test.ts`

Expected: FAIL because `./api` does not exist.

- [ ] **Step 3: Add dependencies and minimal config implementation**

First create `packages/config/package.json` with `{ "name": "@repo/config", "version": "0.1.0", "private": true, "type": "module" }` and the TypeScript config. Then run: `rtk bun add --cwd packages/config @t3-oss/env-core zod`

Create `common.ts` with `commonServerSchema = z.object({ NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"), DATABASE_URL: z.string().url() })`. Implement each loader with an explicit `runtimeEnv` argument; return camelCase properties, never the raw environment object. `createApiConfig` additionally requires coerced `PORT` and `CORS_ORIGIN`; worker and scheduler initially return only the common values. Export the three loaders from `index.ts`.

Set the package name to `@repo/config`, add `check-types`, `lint`, and `clean` scripts matching other packages, add it to Turbo task discovery, and add `@repo/config: "*"` to the future API/worker/scheduler consumers only.

- [ ] **Step 4: Re-run focused config tests**

Run: `rtk bun test packages/config/src/api.test.ts packages/config/src/worker.test.ts packages/config/src/scheduler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add package.json bun.lockb turbo.json packages/config
rtk git commit -m "feat(config): add typed runtime configuration"
```

### Task 2: Reset persistence and remove legacy application code

**Files:** Delete legacy application/repository/tests/migrations; modify database schema/index/package and application index/package.

- [ ] **Step 1: Write the database baseline test**

Create `packages/database/src/client.test.ts`:

```ts
import { expect, test } from "bun:test";
import { prisma } from "./client";

test("exports one Prisma client", () => {
  expect(prisma).toBeDefined();
  expect(typeof prisma.$connect).toBe("function");
});
```

- [ ] **Step 2: Run the test before deletion**

Run: `rtk bun test packages/database/src/client.test.ts`

Expected: PASS; this records the client behavior retained after deleting domain code.

- [ ] **Step 3: Delete domain code and make the schema domain-neutral**

Replace `schema.prisma` with only `generator client` and PostgreSQL `datasource`. Delete every migration folder and `packages/database/src/repositories`. Remove repository/model exports from `packages/database/src/index.ts`; retain only `prisma`, `DatabaseClient`, and `Prisma` types. Replace `packages/application/src/index.ts` with an empty public export marker and remove authorization command files and tests. Remove no-longer-needed application dependencies.

- [ ] **Step 4: Regenerate and verify the baseline**

Run: `rtk bun run --cwd packages/database db:generate`

Expected: command exits 0 and `@prisma/client` is generated for the empty schema.

Run: `rtk bun test packages/database/src/client.test.ts && rtk bun run check-types --filter=@repo/database --filter=@repo/application`

Expected: PASS with no references to Contact, Message, or command roles.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/database packages/application bun.lockb
rtk git commit -m "refactor: reset domain persistence and usecases"
```

### Task 3: Make API a typed `/api` boundary

**Files:** Modify API package and app files; test `apps/api/src/app.test.ts`.

- [ ] **Step 1: Write failing contract tests**

Add to `app.test.ts`:

```ts
test("serves the API status contract under /api", async () => {
  const response = await app.handle(new Request("http://localhost:4101/api/status"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { status: "ok" } });
});

test("uses the API failure envelope", async () => {
  const response = await app.handle(new Request("http://localhost:4101/api/missing"));
  expect(await response.json()).toMatchObject({ success: false, error: "NOT_FOUND" });
});
```

- [ ] **Step 2: Run tests and verify status route fails**

Run: `rtk bun test apps/api/src/app.test.ts`

Expected: FAIL only for `/api/status` because the route does not yet exist.

- [ ] **Step 3: Implement API composition and type export**

Rename the workspace package from `api` to `@repo/api`; expose `./src/index.ts` in `main` and `types`. Replace `@api/*` imports with relative imports so a consuming workspace can resolve `type App` without API-private aliases. Change `lib/env.ts` to export `createApiConfig(process.env)` from `@repo/config`. Add `routes/status.ts` using `new Elysia({ prefix: "/api" }).get("/status", ...)` and TypeBox response schema. Register it in `app.ts`; retain `/health` and the central error envelope. In `server.ts`, use typed config and remove direct `console.log` in favor of the existing logger.

- [ ] **Step 4: Verify API tests and type export**

Run: `rtk bun test apps/api/src/app.test.ts && rtk bun run check-types --filter=@repo/api`

Expected: PASS; `App` is type-only importable and the process is not started by importing `index.ts`.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/api packages/config package.json bun.lockb
rtk git commit -m "feat(api): expose typed Elysia API boundary"
```

### Task 4: Replace tRPC and auth web code with Eden routes

**Files:** Delete legacy web modules; create public/dashboard/API client/provider files; modify web package, config, layout and tests.

- [ ] **Step 1: Write failing Eden client test**

Create `apps/web/lib/api/client.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createApiClient } from "./client";

test("builds an Eden treaty client from the configured URL", () => {
  expect(createApiClient("http://localhost:4101")).toBeDefined();
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `rtk bun test apps/web/lib/api/client.test.ts`

Expected: FAIL because the Eden client module does not exist.

- [ ] **Step 3: Implement the web baseline**

Run: `rtk bun add --cwd apps/web @elysia/eden @t3-oss/env-nextjs`

Add `@repo/api: "*"` as a development dependency and an `elysia` development dependency pinned to the same version as `@repo/api`. Add `transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"]` to Next config. Implement `lib/env.ts` with `createEnv`, requiring `NEXT_PUBLIC_API_URL` and allowing optional `API_INTERNAL_URL`. Implement `createApiClient(baseUrl)` as `treaty<App>(baseUrl)` and export browser/server clients that choose public or internal URL only through `env`.

Replace the tRPC provider with a `QueryClientProvider` only. Delete all tRPC, SSO/auth, callback, proxy, and auth-gated shell files. Move the landing page to `(public)/page.tsx`; create `(dashboard)/dashboard/page.tsx` with a minimal generic shell. Update layout metadata and remove product branding. No component may call `fetch` for API access or import `@repo/database`.

- [ ] **Step 4: Verify web behavior and absence of legacy paths**

Run: `rtk bun test apps/web/lib/api/client.test.ts apps/web/next.config.test.ts`

Expected: PASS.

Run: `rtk rg -n "@trpc|nextapi|authServer|DATABASE_URL|Sleekflow|Oriskin" apps/web`

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/web package.json bun.lockb
rtk git commit -m "refactor(web): replace trpc and auth with Eden"
```

### Task 5: Align environment, tooling, deployment, and rules

**Files:** `.agent/*.md`, env templates, root tooling, Docker/compose, README.

- [ ] **Step 1: Write failing repository-rule checks**

Create `scripts/check-architecture.ts` that exits non-zero when it finds `@trpc`, `/nextapi`, direct `process.env` outside `lib/env.ts` or config loaders, or direct `@repo/database` imports under `apps/web`. Add a Bun test that invokes it against a temporary fixture containing each forbidden pattern.

- [ ] **Step 2: Run the check and verify failure on current stale docs/config**

Run: `rtk bun test scripts/check-architecture.test.ts`

Expected: FAIL until the rule checker and fixtures exist.

- [ ] **Step 3: Implement operational alignment**

Add `.agent/architecture.md`, `api.md`, `database.md`, `web.md`, and `config.md` with the approved constraints. Replace old `.agent/backend.md` and `.agent/frontend.md`. Rewrite env examples so API owns `DATABASE_URL`, web owns API URLs only; add ignored real worker/scheduler files to `.gitignore`. Remove stale SSO/Sleekflow Turbo env keys. Update Docker build contexts for `packages/config` and API type dependency, then update README, compose, and Taskfile commands to describe only the generic API and web foundation. Register `check:architecture` in root scripts and Turbo lint/quality flow.

- [ ] **Step 4: Run repository verification**

Run: `rtk bun test scripts/check-architecture.test.ts && rtk bun run check:architecture && rtk bun run lint && rtk bun run check-types && rtk bun run build`

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
rtk git add .agent .env.api.example .env.web.example .gitignore Taskfile.yml README.md docker-compose.yml Dockerfile.api Dockerfile.web package.json turbo.json scripts
rtk git commit -m "docs: document reusable API and web architecture"
```
