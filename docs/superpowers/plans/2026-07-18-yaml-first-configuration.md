# YAML-First Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace runtime-specific environment files with composable committed YAML configuration modules, one local `.env` secret file, and Zod validation of the resolved result.

**Architecture:** `@repo/config` will load explicitly selected YAML modules, deep-merge them in caller-defined order, and resolve a small, strict environment interpolation syntax. A command wrapper passes the resolved configuration to each runtime so existing config factories continue to validate the final values; it runs before Next.js compilation to preserve `NEXT_PUBLIC_*` behaviour.

**Tech Stack:** TypeScript, Bun, Node.js, Zod, `@t3-oss/env-core`, `@t3-oss/env-nextjs`, a direct YAML parser package, Bun test, Docker Compose.

---

## File structure

- Create `config/base.yaml`, `config/api.yaml`, `config/web.yaml`, `config/worker.yaml`, `config/scheduler.yaml`, `config/realtime.yaml`, and `config/storage.yaml` as initial modules. Future modules are unrestricted and selected explicitly by callers.
- Create `.env.example` as the single secret/value contract; remove `.env.api.example`, `.env.web.example`, `.env.worker.example`, `.env.scheduler.example`, and `.env.realtime.example`.
- Create `packages/config/src/loader.ts` for YAML file selection, parsing, merging, and interpolation.
- Create `packages/config/src/run.ts` for loading root `.env`, executing the loader, and spawning a configured child command.
- Create `packages/config/src/loader.test.ts` and `packages/config/src/run.test.ts` for loader and wrapper behaviour.
- Modify `packages/config/src/index.ts` and `packages/config/package.json` to export the loader and declare its direct parser dependency.
- Modify runtime package scripts, Dockerfiles, `docker-compose.yml`, `.gitignore`, `README.md`, and `.agent/config.md` to use one `.env` and the committed modules.

### Task 1: Add configuration modules and one environment contract

**Files:**
- Create: `config/base.yaml`
- Create: `config/api.yaml`
- Create: `config/web.yaml`
- Create: `config/worker.yaml`
- Create: `config/scheduler.yaml`
- Create: `config/realtime.yaml`
- Create: `config/storage.yaml`
- Create: `.env.example`
- Modify: `.gitignore`
- Delete: `.env.api.example`
- Delete: `.env.web.example`
- Delete: `.env.worker.example`
- Delete: `.env.scheduler.example`
- Delete: `.env.realtime.example`

- [ ] **Step 1: Write a loader fixture test that selects `base`, `api`, and `web`**

```ts
expect(loadConfig({ configDirectory, modules: ["base", "api", "web"], environment })).toMatchObject({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://db",
  PORT: 4101,
  NEXT_PUBLIC_APP_URL: "http://localhost:4100",
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run: `rtk bun test packages/config/src/loader.test.ts`

Expected: FAIL because `loadConfig` and the YAML module fixtures do not exist.

- [ ] **Step 3: Add the initial YAML modules and environment template**

Use the existing runtime defaults, expressed as `${NAME:-default}` values. Put `NODE_ENV`, `DATABASE_URL`, and `LOG_LEVEL` in `base.yaml`; API port/CORS/OpenAPI values in `api.yaml`; `NEXT_PUBLIC_APP_URL` in `web.yaml`; realtime port/secrets in `realtime.yaml`; and optional S3 keys in the separately selectable `storage.yaml` module.

Every secret reference must use `${NAME}` or `${NAME:-}`. `.env.example` lists every supported variable once, with placeholder values only. Keep `.env` ignored and remove the obsolete runtime-specific ignored entries and example files.

- [ ] **Step 4: Run the fixture test to verify the committed module layout**

Run: `rtk bun test packages/config/src/loader.test.ts`

Expected: still FAIL only because the loader is not implemented; fixture files resolve from the repository `config/` directory.

- [ ] **Step 5: Commit the configuration contract**

```bash
git add config .env.example .gitignore
git rm .env.api.example .env.web.example .env.worker.example .env.scheduler.example .env.realtime.example
git commit -m "feat(config): add committed YAML configuration modules"
```

### Task 2: Implement strict YAML loading, merge, and interpolation

**Files:**
- Modify: `packages/config/package.json`
- Modify: `packages/config/src/index.ts`
- Create: `packages/config/src/loader.ts`
- Create: `packages/config/src/loader.test.ts`
- Modify: `bun.lock`

- [ ] **Step 1: Add failing unit tests for every loader contract**

```ts
expect(loadConfig({ configDirectory, modules: ["base", "override"], environment: {} })).toEqual({
  http: { host: "127.0.0.1", port: 4101 },
  queues: ["critical"],
});

expect(() => loadConfig({ configDirectory, modules: ["missing"], environment: {} })).toThrow(
  'Configuration module "missing" was not found',
);
expect(() => loadConfig({ configDirectory, modules: ["required-secret"], environment: {} })).toThrow(
  'Missing configuration environment variable "DATABASE_URL"',
);
expect(loadConfig({ configDirectory, modules: ["defaults"], environment: {} })).toEqual({ port: "4101" });
```

Include tests proving `${NAME}` accepts a non-empty value, `${NAME:-fallback}` uses a value when present and fallback when absent/empty, `${NAME:-}` produces an empty string, interpolation is single-pass, nested objects deep-merge, and later arrays replace earlier arrays.

- [ ] **Step 2: Run the loader tests to verify RED**

Run: `rtk bun test packages/config/src/loader.test.ts`

Expected: FAIL because no loader exports exist.

- [ ] **Step 3: Add the direct parser dependency and implement the loader**

Install `yaml` as a direct dependency of `@repo/config` with Bun. Implement and export:

```ts
export type LoadConfigOptions = {
  configDirectory?: string;
  modules: readonly string[];
  environment: Record<string, string | undefined>;
};

export function loadConfig(options: LoadConfigOptions): Record<string, unknown>;
```

Accept only module identifiers matching `/^[a-z][a-z0-9-]*$/`, read `<configDirectory>/<module>.yaml`, parse YAML documents as objects, and reject non-object top-level documents. Merge plain objects recursively; replace every other value, including arrays and `null`. Resolve interpolation in string leaves after merging with `/\$\{([A-Z][A-Z0-9_]*)(:-([^}]*))?\}/g`; reject missing required variables and do not recursively interpolate replacement output. Export the loader from `src/index.ts`.

- [ ] **Step 4: Run focused GREEN verification**

Run: `rtk bun test packages/config/src/loader.test.ts && rtk turbo run check-types --filter=@repo/config`

Expected: every loader test passes and the config workspace typecheck exits `0`.

- [ ] **Step 5: Commit the loader**

```bash
git add packages/config/package.json packages/config/src/index.ts packages/config/src/loader.ts packages/config/src/loader.test.ts bun.lock
git commit -m "feat(config): load composable YAML modules"
```

### Task 3: Add the command wrapper and retain Zod validation

**Files:**
- Create: `packages/config/src/run.ts`
- Create: `packages/config/src/run.test.ts`
- Modify: `packages/config/src/common.ts`
- Modify: `packages/config/src/common.test.ts`
- Modify: `packages/config/src/api.test.ts`
- Modify: `packages/config/src/worker.test.ts`
- Modify: `packages/config/src/scheduler.test.ts`
- Modify: `packages/config/src/realtime.test.ts`

- [ ] **Step 1: Write failing wrapper and validation tests**

```ts
const result = await runConfiguredCommand({
  modules: ["base", "api"],
  environment: { DATABASE_URL: "postgresql://db" },
  command: [process.execPath, fixturePath],
});
expect(result.stdout).toContain('"PORT":"4101"');

expect(() => createApiConfig(loadConfig({ modules: ["base", "api"], environment: {} }))).toThrow(
  'Missing configuration environment variable "DATABASE_URL"',
);
```

Also preserve current coverage for paired OpenAPI credentials, optional S3 configuration, and production database requirements, but feed the factories the loader result rather than a hand-written environment map.

- [ ] **Step 2: Run tests to verify RED**

Run: `rtk bun test packages/config/src/run.test.ts packages/config/src/common.test.ts packages/config/src/api.test.ts packages/config/src/worker.test.ts packages/config/src/scheduler.test.ts packages/config/src/realtime.test.ts`

Expected: FAIL because the wrapper does not exist and runtime factories have not been exercised through YAML.

- [ ] **Step 3: Implement a wrapper that starts a child with resolved configuration**

Implement a Bun-compatible executable accepting `--modules base,api` followed by `--` and a command. Development scripts invoke this executable through `bun --env-file=../../.env`, while containers and deployment platforms supply its process environment directly. The executable calls `loadConfig`, converts only scalar resolved values to child environment strings, and uses `Bun.spawn` with inherited stdio and the parent environment. It must return the child exit status and never print resolved values or secrets.

Keep Zod factories as the final validation layer. Remove the old implicit local `DATABASE_URL` default so `DATABASE_URL` is required through the committed `${DATABASE_URL}` reference; retain the explicit production guard as defense in depth. Add a small helper only if necessary to avoid duplicating wrapper parsing between scripts and tests.

- [ ] **Step 4: Run focused GREEN verification**

Run: `rtk task test:config && rtk turbo run check-types --filter=@repo/config`

Expected: the wrapper, loader-backed runtime validation, and existing config tests pass.

- [ ] **Step 5: Commit the wrapper and validation migration**

```bash
git add packages/config/src/run.ts packages/config/src/run.test.ts packages/config/src/common.ts packages/config/src/common.test.ts packages/config/src/api.test.ts packages/config/src/worker.test.ts packages/config/src/scheduler.test.ts packages/config/src/realtime.test.ts
git commit -m "feat(config): run processes from resolved YAML configuration"
```

### Task 4: Migrate every runtime and protect Next.js public values

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/worker/package.json`
- Modify: `apps/scheduler/package.json`
- Modify: `apps/realtime/package.json`
- Modify: `apps/web/lib/env.ts`
- Modify: `apps/web/lib/api/client.test.ts`
- Modify: `apps/web/next.config.test.ts`
- Modify: `apps/web/app/api/[[...slugs]]/route.test.ts`

- [ ] **Step 1: Write failing runtime-selection and browser-safety tests**

```ts
expect(resolvedWebEnvironment.NEXT_PUBLIC_APP_URL).toBe("http://localhost:4100");
expect(resolvedWebEnvironment).not.toHaveProperty("REALTIME_TICKET_SECRET");
expect(createApiClient(env.NEXT_PUBLIC_APP_URL)).toBeDefined();
```

Add a route test that starts the embedded API with the selected `base`, `api`, and `web` modules and still receives the normal `/api/status` envelope. Add a config-wrapper test for a custom module list containing `realtime`; it must allow server-side selection without adding realtime secrets to `NEXT_PUBLIC_*` output.

- [ ] **Step 2: Run the runtime tests to verify RED**

Run: `rtk bun test apps/web/lib/api/client.test.ts apps/web/next.config.test.ts 'apps/web/app/api/[[...slugs]]/route.test.ts'`

Expected: FAIL because runtime scripts still select `.env.<runtime>` files and no resolved module list is supplied.

- [ ] **Step 3: Route each script through the wrapper with explicit module lists**

Set the initial lists to `base,api,storage` for standalone API, `base,web,api,storage` for web (the embedded boundary needs API settings), `base,worker,storage` for worker, `base,scheduler` for scheduler, and `base,realtime` for realtime. Keep module lists as script arguments, not hard-coded restrictions in the loader; a project may freely add or remove modules as its runtime needs change.

Ensure the web dev and build scripts execute the wrapper before `next dev`/`next build`, and expose only resolved `NEXT_PUBLIC_*` keys to browser code. Keep `apps/web/lib/env.ts` as the browser allowlist and do not import filesystem loader code into a client component. Update tests to set configuration through the wrapper/process environment instead of assigning `.env.web` values.

- [ ] **Step 4: Run focused GREEN verification**

Run: `rtk task test:web && rtk task test:api && rtk task test:worker && rtk task test:scheduler && rtk turbo run check-types --filter=web --filter=@repo/api --filter=@repo/worker --filter=@repo/scheduler --filter=@repo/realtime-server`

Expected: all runtime tests and typechecks pass, including the embedded API route and Eden client tests.

- [ ] **Step 5: Commit the runtime migration**

```bash
git add apps/web apps/api apps/worker apps/scheduler apps/realtime
git commit -m "feat(config): run every runtime from YAML modules"
```

### Task 5: Update containers, Compose, and project documentation

**Files:**
- Modify: `Dockerfile.web`
- Modify: `Dockerfile.api`
- Modify: `Dockerfile.worker`
- Modify: `Dockerfile.scheduler`
- Modify: `Dockerfile.realtime`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `.agent/config.md`

- [ ] **Step 1: Add failing static/deployment assertions**

```ts
expect(await Bun.file("docker-compose.yml").text()).toContain("- .env");
expect(await Bun.file("docker-compose.yml").text()).not.toContain(".env.web");
expect(await Bun.file("Dockerfile.web").text()).toContain("/app/config");
```

Place these checks in a focused repository-level configuration test so the required committed config directory and single local environment contract cannot regress.

- [ ] **Step 2: Run the deployment test to verify RED**

Run: `rtk bun test packages/config/src/deployment.test.ts`

Expected: FAIL because Compose and container images still reference runtime-specific environment files and do not copy `config/`.

- [ ] **Step 3: Update Docker and documentation**

Copy the committed `config/` directory into every final image. In the web builder stage, invoke the wrapper before the Next build so resolved public values are available at compile time; in the runner stage use the wrapper or a generated, non-secret resolved configuration as required by the selected command. Change Compose `env_file` entries to `.env` and preserve explicit Compose `environment` values as deployment overrides.

Document `cp .env.example .env`, module composition, merge order, `${NAME}`/`${NAME:-fallback}`, the no-literal-secret rule, failed required interpolation, and the fact that production injects environment values through its deployment platform. State explicitly that YAML selection is caller-defined and browser exposure remains limited to `NEXT_PUBLIC_*`.

- [ ] **Step 4: Run complete verification**

Run: `rtk task quality && rtk task build`

Expected: all tests, lint, typechecks, and builds exit `0`.

- [ ] **Step 5: Commit deployment and documentation changes**

```bash
git add Dockerfile.web Dockerfile.api Dockerfile.worker Dockerfile.scheduler Dockerfile.realtime docker-compose.yml README.md .agent/config.md packages/config/src/deployment.test.ts
git commit -m "docs(config): document YAML-first configuration"
```
