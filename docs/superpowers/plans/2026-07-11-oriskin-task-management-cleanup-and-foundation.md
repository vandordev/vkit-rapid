# Oriskin Task Management Cleanup and Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the SleekFlow console coupling, establish `/nextapi` for internal Next.js handlers, retain Elysia as a health/external boundary, and prepare the repository for the Oriskin task-management modules.

**Architecture:** Next.js calls internal tRPC procedures through same-origin `/nextapi/trpc/*`. Mutations call shared command usecases; read procedures may call Prisma or another infrastructure client directly so their query shapes remain transport-specific. Elysia remains a separate Bun service with `/health` and a reserved `/api/*` namespace for future external integrations.

**Tech Stack:** Bun, Turborepo, Next.js 16 App Router, tRPC 11, Elysia 1, Prisma 6, PostgreSQL, Mantine, Vitest/Bun tests, Docker Compose.

---

## File Map

- `apps/web/app/nextapi/`: new internal Next.js route-handler namespace for tRPC, auth, and backend proxy routes.
- `apps/web/components/trpc-provider.tsx`: points the browser client to `/nextapi/trpc`.
- `apps/web/app/nextapi/trpc/[trpc]/route.ts`: internal tRPC fetch adapter.
- `apps/web/app/nextapi/auth/*`: internal auth callback/logout handlers.
- `apps/web/app/nextapi/backends/[target]/[...slug]/*`: retained upstream proxy, if still required by SSO.
- `apps/web/next.config.mjs`: removes the `/api/*` gateway fallback rewrite.
- `apps/web/app/api/*`: deleted after moved route tests pass; no Next.js handler remains under `/api`.
- `apps/web/lib/api.ts` and `apps/web/lib/gateway-data.ts`: removed from task-management UI, or retained only for an explicit Elysia health client during cleanup.
- `apps/api/src/app.ts`: reduced Elysia composition and health-only runtime.
- `apps/api/src/routes/index.ts` and `apps/api/src/routes/health.ts`: the retained external health boundary.
- `apps/api/src/modules/messages/*`, `apps/api/src/modules/buffer/*`, and `apps/api/src/routes/gateway.ts`: retired from the active application after route-contract review.
- `apps/api/src/lib/env.ts`: removes retired SleekFlow runtime variables after the contract inventory is recorded.
- `apps/api/.env.example`, `apps/web/.env.example`, root `.env.api.example`, root `.env.web.example`: canonical environment templates.
- `docker-compose.yml`, `deploy/sleekflow-production.compose.yml`, `Dockerfile.api`, `Dockerfile.web`: load the correct environment boundary and advertise the retained health endpoint.
- `README.md`: documents Oriskin Task Management, local setup, API boundaries, and cleanup status.
- `apps/web/app/nextapi/backends/[target]/[...slug]/route.test.ts`: verifies the moved proxy route.
- `apps/web/components/trpc-provider.test.tsx`: verifies the internal tRPC endpoint.
- `apps/api/src/app.test.ts`: verifies `/health` and rejects retired gateway routes.

## Task 1: Freeze the Existing External Contract

**Files:**
- Create: `docs/superpowers/plans/2026-07-11-sleekflow-contract-inventory.md`
- Inspect: `apps/api/src/modules/messages/routes.ts`, `apps/api/src/routes/gateway.ts`, `apps/api/src/routes/health.ts`, `README.md`, `deploy/sleekflow-production.compose.yml`

- [ ] **Step 1: Record every active gateway route and alias**

  Copy the route paths from `apps/api/src/modules/messages/routes.ts`, `apps/api/src/routes/gateway.ts`, and `README.md` into the inventory, grouped as retained, retired, or requiring an explicit external cutover.

- [ ] **Step 2: Record route consumers and deployment exposure**

  Compare the deployment Traefik rule, Docker health checks, and the current web `gateway-data.ts` client. Mark `/health` as retained and mark the message/contact/conversation gateway routes as external-contract candidates.

- [ ] **Step 3: Record database and environment dependencies**

  List the legacy SleekFlow Prisma models and the variables used by `apps/api/src/lib/env.ts`. Explicitly state that the cleanup phase does not drop legacy tables or connect to the production ticketing database.

- [ ] **Step 4: Commit the inventory**

  Run:

  ```bash
  git add docs/superpowers/plans/2026-07-11-sleekflow-contract-inventory.md
  git commit -m "docs: freeze legacy gateway contract"
  ```

  Expected: one documentation commit containing no application-code changes.

## Task 2: Add Canonical Root Environment Templates

**Files:**
- Create: `.env.api.example`, `.env.web.example`
- Modify: `.gitignore`, `apps/api/.gitignore`, `apps/web/.gitignore`
- Remove after migration: `apps/api/.env` (local ignored file only)

- [ ] **Step 1: Write the templates without secrets**

  Put Elysia/external-boundary variables such as `CORS_ORIGIN` and future external integration secrets in `.env.api.example`. Put Next.js server variables, including `DATABASE_URL` for tRPC, in `.env.web.example`; only `NEXT_PUBLIC_*` values are exposed to the browser bundle.

- [ ] **Step 2: Make the ignore rules explicit**

  Add these patterns to the root `.gitignore`:

  ```gitignore
  /.env.api
  /.env.web
  ```

  Keep `.env.example` compatibility only if a deployment script still depends on it; do not add real environment files to Git.

- [ ] **Step 3: Verify no secret entered the templates**

  Run:

  ```bash
  rg -n "DATABASE_URL|API_KEY|TOKEN|PASSWORD|SECRET" .env.api.example .env.web.example
  git status --short --ignored
  ```

  Expected: only placeholder values such as `REPLACE_ME` appear, and real `.env.api`/`.env.web` files are ignored.

- [ ] **Step 4: Commit the configuration templates**

  ```bash
  git add .gitignore apps/api/.gitignore apps/web/.gitignore .env.api.example .env.web.example
  git commit -m "chore: define root environment boundaries"
  ```

## Task 3: Move Next.js Internal Route Handlers to `/nextapi`

**Files:**
- Create: `apps/web/app/nextapi/trpc/[trpc]/route.ts`
- Create: `apps/web/app/nextapi/auth/callback/route.ts`
- Create: `apps/web/app/nextapi/auth/logout/route.ts`
- Create: `apps/web/app/nextapi/backends/[target]/[...slug]/route.ts`
- Create: `apps/web/app/nextapi/backends/[target]/[...slug]/route.test.ts`
- Modify: `apps/web/components/trpc-provider.tsx`, `apps/web/app/nextapi/trpc/[trpc]/route.ts`, `apps/web/app/nextapi/auth/callback/route.ts`, `apps/web/app/nextapi/backends/[target]/[...slug]/route.test.ts`
- Delete after verification: `apps/web/app/api/trpc/[trpc]/route.ts`, `apps/web/app/api/auth/callback/route.ts`, `apps/web/app/api/auth/logout/route.ts`, `apps/web/app/api/backends/[target]/[...slug]/route.ts`, `apps/web/app/api/backends/[target]/[...slug]/route.test.ts`

- [ ] **Step 1: Add a failing tRPC endpoint test**

  Extend the route test setup to call the route handler with a request URL containing `/nextapi/trpc`. Assert the handler receives `endpoint: "/nextapi/trpc"` and returns the same procedure result currently expected from `/api/trpc`.

- [ ] **Step 2: Move the tRPC handler and change its endpoint**

  Move the existing fetch adapter unchanged except for:

  ```ts
  endpoint: "/nextapi/trpc",
  ```

  Keep `createTRPCContext` and `appRouter` as the only dependencies of the handler.

- [ ] **Step 3: Point the browser client at the new endpoint**

  In `apps/web/components/trpc-provider.tsx`, change the link URL from:

  ```ts
  url: `${getBaseUrl()}/api/trpc`,
  ```

  to:

  ```ts
  url: `${getBaseUrl()}/nextapi/trpc`,
  ```

- [ ] **Step 4: Move auth and backend proxy handlers**

  Move the existing handlers without changing their business logic. In the callback route, change the internal proxy URL from:

  ```ts
  `${requestBaseUrl}/api/backends/auth/api/sso`
  ```

  to:

  ```ts
  `${requestBaseUrl}/nextapi/backends/auth/api/sso`
  ```

  Update the route test URL fixtures to `/nextapi/backends/...`.

- [ ] **Step 5: Run focused web tests**

  ```bash
  bun test apps/web/app/nextapi/backends/[target]/[...slug]/route.test.ts
  bun run --cwd apps/web check-types
  ```

  Expected: proxy tests pass and TypeScript reports no missing route imports.

- [ ] **Step 6: Remove the old `/api` handlers and commit**

  ```bash
  git add apps/web/app/nextapi apps/web/app/api apps/web/components/trpc-provider.tsx
  git commit -m "refactor: move internal next routes under nextapi"
  ```

## Task 4: Remove the `/api` Rewrite and Correct Internal Consumers

**Files:**
- Modify: `apps/web/next.config.mjs`, `apps/web/components/app-shell.tsx`, `apps/web/lib/auth-api.ts`, `apps/web/app/callback/route.ts`, `apps/web/app/layout.tsx`
- Test: `apps/web/lib/auth-api.test.ts`, route-handler tests under `apps/web/app/nextapi`

- [ ] **Step 1: Add a failing rewrite assertion**

  Add a test or deterministic config assertion that `next.config.mjs` does not define a fallback from `/api/:path*` to the Elysia base URL.

- [ ] **Step 2: Remove the internal gateway fallback**

  Delete the `rewrites()` fallback that maps `/api/:path*` to `${apiUrl}/api/:path*`. Keep `output: "standalone"` and compiler settings unchanged.

- [ ] **Step 3: Update browser calls to internal handlers**

  Change internal calls such as:

  ```ts
  fetch("/api/auth/logout", { method: "POST" })
  ```

  to:

  ```ts
  fetch("/nextapi/auth/logout", { method: "POST" })
  ```

  Update the SSO callback URL and any auth API base path that refers to the local Next proxy. Leave URLs that intentionally target an external backend unchanged.

- [ ] **Step 4: Verify no internal `/api` caller remains**

  ```bash
  rg -n '"/api/(trpc|auth|backends)|`/api/(trpc|auth|backends)' apps/web
  ```

  Expected: no matches. Existing external Elysia route documentation may continue to mention `/api/*` only in the external-boundary module.

- [ ] **Step 5: Commit the namespace change**

  ```bash
  git add apps/web/next.config.mjs apps/web/components apps/web/lib apps/web/app
  git commit -m "refactor: reserve api namespace for external service"
  ```

## Task 5: Reduce Elysia to the External Health Boundary

**Files:**
- Modify: `apps/api/src/app.ts`, `apps/api/src/routes/index.ts`, `apps/api/src/lib/env.ts`, `apps/api/src/server.ts`
- Retain: `apps/api/src/routes/health.ts`
- Retire from active imports after contract approval: `apps/api/src/routes/gateway.ts`, `apps/api/src/modules/messages/*`, `apps/api/src/modules/buffer/*`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add health and retired-route failing tests**

  Add tests that call `app.handle(new Request("http://localhost:4101/health"))` and expect a successful health response, then call a representative retired route such as `/api/messages` and expect `404` after cleanup.

- [ ] **Step 2: Stop starting the message buffer worker**

  Remove the `.onStart(() => startBufferWorker())` hook from `apps/api/src/app.ts` once the contract inventory confirms no gateway delivery is retained by this service.

- [ ] **Step 3: Compose only health and common middleware**

  Keep request IDs, error handling, logging, CORS, and `healthRoutes`. Remove active imports and `.use()` calls for `messageRoutes` and `gatewayRoutes`. Do not remove the Elysia app or its `/health` route.

- [ ] **Step 4: Remove retired environment requirements**

  Delete only variables proven retired by Task 1 from `apps/api/src/lib/env.ts` and both environment examples. Keep `PORT`, `NODE_ENV`, `CORS_ORIGIN`, and logging settings needed by health.

- [ ] **Step 5: Run API tests**

  ```bash
  bun test apps/api/src/app.test.ts apps/api/src/lib/auth.test.ts
  bun run --cwd apps/api check-types
  ```

  Expected: health succeeds, retired routes return 404, and no buffer/message import is required by the API app.

- [ ] **Step 6: Commit the Elysia boundary**

  ```bash
  git add apps/api/src apps/api/.env.example
  git commit -m "refactor: reduce external api to health boundary"
  ```

## Task 6: Update Compose, Docker, and Documentation

**Files:**
- Modify: `docker-compose.yml`, `deploy/sleekflow-production.compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `README.md`
- Test: Compose configuration and container health checks

- [ ] **Step 1: Use per-service environment files**

  Configure local Compose so API uses the root `.env.api` and web uses root `.env.web`. Keep non-secret service wiring in Compose overrides.

- [ ] **Step 2: Remove obsolete gateway routing from deployment**

  Change the Traefik API rule to expose `/health` and any explicitly retained external routes only. Do not add `/nextapi` to the API container; those handlers belong to the web container.

- [ ] **Step 3: Keep web build configuration server-safe**

  Ensure `NEXT_PUBLIC_*` values required by Next are supplied during the web image build and that API-only variables are never copied into the web build context as runtime values.

- [ ] **Step 4: Rewrite the README**

  Document the Oriskin Task Management purpose, `bun run dev`, `/nextapi` as internal Next routes, `/health` and `/api/*` as Elysia boundaries, root env files, and the fact that the production ticketing database is not accessed.

- [ ] **Step 5: Validate configuration and images**

  ```bash
  docker compose config
  bun run check-types
  bun run lint
  bun run build
  ```

  Expected: Compose renders without unresolved variables, all checks pass, and both Docker build contexts remain valid.

- [ ] **Step 6: Commit deployment cleanup**

  ```bash
  git add docker-compose.yml deploy/sleekflow-production.compose.yml Dockerfile.api Dockerfile.web README.md
  git commit -m "chore: align deployment with api boundaries"
  ```

## Task 7: Establish the Command Package Convention

**Files:**
- Create: `packages/application/package.json`, `packages/application/tsconfig.json`, `packages/application/src/index.ts`, `packages/application/src/commands/authorization.ts`
- Create: `apps/web/server/trpc/routers/task-management.ts`
- Modify: `apps/web/server/trpc/root.ts`, `apps/web/server/trpc/context.ts`, `apps/web/package.json`, `package.json`, `turbo.json`
- Test: `packages/application/src/commands/authorization.test.ts`

- [ ] **Step 1: Define the first command policy**

  Create `packages/application/src/commands/authorization.ts` with a typed `assertCanExecuteCommand(role, action)` function for `submit`, `approve`, `edit`, and `complete`. It must be a pure policy function with no ports/interfaces or repository abstraction. Commands that call Prisma directly are added with the Task model in the next feature plan.

- [ ] **Step 2: Write a command policy test**

  Assert that member can submit, lead/manager/head IT can approve, only lead can edit/complete active work, and an unsupported role/action throws a typed authorization error. The test must fail before the policy implementation exists.

- [ ] **Step 3: Wire the package through workspace dependencies**

  Add `@repo/application` to the workspace. Run `bun install` to update `bun.lockb`. Do not add a tRPC router until the first task-management schema exists.

- [ ] **Step 4: Run focused foundation tests**

  ```bash
  bun test packages/application/src/commands/authorization.test.ts
  bun run check-types
  ```

  Expected: command-policy tests pass and the workspace typechecks.

- [ ] **Step 5: Commit the command convention**

  ```bash
  git add packages/application apps/web/server/trpc package.json turbo.json bun.lockb
  git commit -m "feat: establish command policy package"
  ```

## Task 8: Final Cleanup Verification and Handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-07-11-sleekflow-contract-inventory.md`, `README.md`
- Test: repository-wide checks

- [ ] **Step 1: Scan for stale boundary references**

  ```bash
  rg -n '/api/trpc|/api/auth|/api/backends|ORISKIN_WEBHOOK_URL|ORISKIN_FORWARDING_ENABLED|SLEEKFLOW_' apps packages README.md docker-compose.yml deploy
  ```

  Expected: only intentionally retained external-contract inventory or explicit phase-two documentation contains a match.

- [ ] **Step 2: Run the complete verification suite**

  ```bash
  bun test
  bun run lint
  bun run check-types
  bun run build
  docker compose config
  ```

  Expected: all commands exit successfully.

- [ ] **Step 3: Confirm the working tree and commits**

  ```bash
  git status --short
  git log --oneline -8
  ```

  Expected: only explicitly user-owned untracked files remain, and each cleanup boundary has a focused commit.

## Follow-up Plans

After this cleanup/foundation plan is complete and reviewed, create separate implementation plans for the independent feature groups:

1. Master data and authorization.
2. FS/TO workflow and documents.
3. Planning, Gantt, and dependencies.
4. Development Issues and Solution Activity.
5. Daily Huddles and notes.
6. Excel report generation.
7. GitHub evidence integration.

Each follow-up plan must preserve the usecase/tRPC/Elysia boundaries established here and must include focused tests before implementation.
