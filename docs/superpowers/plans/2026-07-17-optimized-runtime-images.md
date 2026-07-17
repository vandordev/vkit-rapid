# Optimized Runtime Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Use Turbo-pruned, production-only Docker images for all deployable runtimes.

**Architecture:** Each runtime prunes its own workspace dependency graph. Build stages install the complete pruned graph; API, worker, scheduler, and realtime runners install only production dependencies, while web retains a minimal Next standalone runner. Prisma artifacts are generated and copied only by runtimes that depend on Prisma.

**Tech Stack:** Docker Buildx, Dockerfile syntax v1.11, Turbo, Bun, Node.js, Prisma, Bun test.

---

## File structure

- Create: scripts/dockerfiles.test.ts — Dockerfile structural contract tests.
- Create: .dockerignore — stable Docker build context boundary.
- Modify: Dockerfile.web, Dockerfile.api, Dockerfile.worker, Dockerfile.scheduler.
- Create: Dockerfile.realtime after the optional realtime runtime plan has created its workspace.
- Modify: Taskfile.yml and README.md.

### Task 1: Lock the image contracts with a test

**Files:** scripts/dockerfiles.test.ts.

- [ ] **Step 1: Write the failing Dockerfile tests**

~~~ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = join(import.meta.dir, "..");
for (const [file, workspace] of [
  ["Dockerfile.api", "@repo/api"],
  ["Dockerfile.worker", "@repo/worker"],
  ["Dockerfile.scheduler", "@repo/scheduler"],
] as const) {
  test(file + " prunes and ships only production dependencies", () => {
    const dockerfile = readFileSync(join(root, file), "utf8");
    expect(dockerfile).toContain("turbo@2.8.1 prune " + workspace + " --docker");
    expect(dockerfile).toContain("bun install --production --frozen-lockfile --ignore-scripts");
    expect(dockerfile).not.toContain("COPY --from=builder /app/node_modules ./node_modules");
  });
}
test("Dockerfile.web builds from a pruned graph", () => {
  expect(readFileSync(join(root, "Dockerfile.web"), "utf8")).toContain("turbo@2.8.1 prune web --docker");
});
~~~

- [ ] **Step 2: Run RED**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: FAIL because the current images copy the full workspace graph and do not prune.

- [ ] **Step 3: Verify test failure is structural**

Confirm each failure cites the missing expected prune command rather than a test import or file path error.

### Task 2: Add a safe Docker context and optimized web build

**Files:** .dockerignore, Dockerfile.web.

- [ ] **Step 1: Write the failing web-specific assertion**

~~~ts
test("Dockerfile.web uses cache mounts and a non-root standalone runner", () => {
  const dockerfile = readFileSync(join(root, "Dockerfile.web"), "utf8");
  expect(dockerfile).toContain("--mount=type=cache,id=bun-web-install");
  expect(dockerfile).toContain("--mount=type=cache,id=next-web-build");
  expect(dockerfile).toContain("USER nextjs");
});
~~~

- [ ] **Step 2: Run RED**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: FAIL because the current web Dockerfile has no pruned build or BuildKit cache mounts.

- [ ] **Step 3: Replace the web Dockerfile with a pruned build**

~~~dockerfile
# syntax=docker/dockerfile:1.11
FROM oven/bun:1.1.45-alpine AS base
WORKDIR /app
FROM base AS prepare
COPY . .
RUN --mount=type=cache,id=bun-web-prune,target=/root/.bun/install/cache \
    bunx turbo@2.8.1 prune web --docker
FROM base AS deps
COPY --from=prepare /app/out/json/ ./
RUN --mount=type=cache,id=bun-web-install,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts
~~~

Continue the existing Next standalone runner: use pruned full source, generate Prisma, mount next-web-build at /app/apps/web/.next/cache, and retain the existing nextjs user, port, and command.

- [ ] **Step 4: Add the context boundary**

~~~gitignore
.git
node_modules
**/node_modules
.turbo
**/.next
**/dist
coverage
.env*
!.env*.example
*.log
~~~

- [ ] **Step 5: Run GREEN and commit**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: PASS.

~~~bash
git add scripts/dockerfiles.test.ts .dockerignore Dockerfile.web
git commit -m "build(web): prune Docker build context"
~~~

### Task 3: Prune API and job runtime images

**Files:** Dockerfile.api, Dockerfile.worker, Dockerfile.scheduler.

- [ ] **Step 1: Add failing API Prisma output assertions**

~~~ts
test("API and worker copy generated Prisma artifacts into their runners", () => {
  for (const file of ["Dockerfile.api", "Dockerfile.worker"]) {
    expect(readFileSync(join(root, file), "utf8")).toContain("COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma");
  }
});
~~~

- [ ] **Step 2: Run RED**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: FAIL because API and worker lack the production-dependency/pruned contract.

- [ ] **Step 3: Use the four-stage non-web pattern**

~~~dockerfile
FROM oven/bun:1.1.45-alpine AS base
WORKDIR /app
FROM base AS pruner
COPY . .
RUN bunx turbo@2.8.1 prune @repo/api --docker
FROM base AS build-deps
COPY --from=pruner /app/out/json/ ./
RUN bun install --frozen-lockfile --ignore-scripts
FROM base AS prod-deps
COPY --from=pruner /app/out/json/ ./
RUN bun install --production --frozen-lockfile --ignore-scripts
~~~

For API and worker, generate Prisma in the builder and copy node_modules/.prisma from builder to runner. For scheduler, omit both Prisma commands. Each runner copies node_modules only from prod-deps, then the built app, packages, and root manifest; retain the current compiled entrypoint command.

- [ ] **Step 4: Run GREEN and commit**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: PASS.

~~~bash
git add Dockerfile.api Dockerfile.worker Dockerfile.scheduler scripts/dockerfiles.test.ts
git commit -m "build: prune API and job runtime images"
~~~

### Task 4: Apply the pattern to the future realtime runtime

**Files:** Dockerfile.realtime, scripts/dockerfiles.test.ts.

- [ ] **Step 1: Extend the contract test only after apps/realtime exists**

~~~ts
["Dockerfile.realtime", "@repo/realtime-server"],
~~~

- [ ] **Step 2: Run RED**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: FAIL because no realtime Dockerfile exists before the optional realtime implementation is completed.

- [ ] **Step 3: Add the production-only realtime image**

~~~dockerfile
FROM base AS pruner
COPY . .
RUN bunx turbo@2.8.1 prune @repo/realtime-server --docker
FROM base AS prod-deps
COPY --from=pruner /app/out/json/ ./
RUN bun install --production --frozen-lockfile --ignore-scripts
~~~

Use a build-deps/builder pair to compile apps/realtime, copy production dependencies and compiled output to the runner, run as a non-root user, expose port 4102, and execute apps/realtime/dist/main.js.

- [ ] **Step 4: Run GREEN and commit**

Run: rtk bun test scripts/dockerfiles.test.ts  
Expected: PASS.

~~~bash
git add Dockerfile.realtime scripts/dockerfiles.test.ts
git commit -m "build(realtime): add optimized runtime image"
~~~

### Task 5: Verify images and document the deployment boundary

**Files:** Taskfile.yml, README.md.

- [ ] **Step 1: Add explicit image build tasks**

~~~yaml
docker:build:api:
  desc: Build the standalone API image
  cmds: [rtk docker buildx build --load --platform=linux/amd64 --file Dockerfile.api --tag vkit-rapid-api:local .]
~~~

Add equivalent docker:build:web, docker:build:worker, docker:build:scheduler, and docker:build:realtime tasks. The realtime task is documented as available only after its optional runtime has been enabled.

- [ ] **Step 2: Build every available image**

Run: rtk docker buildx build --load --platform=linux/amd64 --file Dockerfile.web --tag vkit-rapid-web:local .  
Run: rtk docker buildx build --load --platform=linux/amd64 --file Dockerfile.api --tag vkit-rapid-api:local .  
Run: rtk docker buildx build --load --platform=linux/amd64 --file Dockerfile.worker --tag vkit-rapid-worker:local .  
Run: rtk docker buildx build --load --platform=linux/amd64 --file Dockerfile.scheduler --tag vkit-rapid-scheduler:local .  
Expected: every command exits 0.

- [ ] **Step 3: Inspect runner metadata and document opt-in services**

Run: rtk docker image inspect vkit-rapid-web:local vkit-rapid-api:local vkit-rapid-worker:local vkit-rapid-scheduler:local --format '{{.Config.User}} {{json .Config.Cmd}}'  
Expected: web prints nextjs and every image reports its intended runtime command.

Document that Dockerfiles build images only; image registry push, deployment, and optional realtime activation remain project/operator decisions.

- [ ] **Step 4: Run repository verification and commit**

Run: rtk task quality && rtk task build && rtk git diff --check  
Expected: all commands exit 0.

~~~bash
git add Taskfile.yml README.md
git commit -m "docs: describe optimized runtime images"
~~~

