# YAML-First Configuration Design

## Goal

Make committed YAML files the primary, composable source of application configuration. A single uncommitted `.env` supplies local secrets and deployment environments supply the same values in production. Every process validates its final merged configuration with its existing Zod schema before it starts.

## Configuration model

The repository adds a committed `config/` directory. It contains any number of YAML modules; file names have no runtime ownership rule. A process explicitly selects the modules it needs and their load order. For example, the embedded web/API process may select `base`, `api`, `web`, and `realtime`, while a worker may select `base`, `worker`, and `storage`.

The selected modules are merged from left to right. Objects deep-merge; a later scalar, `null`, or array replaces an earlier value. Arrays never concatenate implicitly. The loader rejects a missing selected file and duplicate module names so a process cannot accidentally start with an incomplete or ambiguous configuration.

The initial YAML key shape remains the existing uppercase environment-key shape (`DATABASE_URL`, `PORT`, `REALTIME_PORT`, and so on). This deliberately preserves the current `@t3-oss/env-core` and `@t3-oss/env-nextjs` schemas and avoids an unrelated application-wide rename. YAML provides defaults through interpolation rather than embedding production secrets:

```yaml
# config/api.yaml
PORT: ${PORT:-4101}
CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:4100}
OPENAPI_SERVER_URL: ${OPENAPI_SERVER_URL:-http://localhost:4101}
```

```yaml
# config/base.yaml
NODE_ENV: ${NODE_ENV:-development}
DATABASE_URL: ${DATABASE_URL}
LOG_LEVEL: ${LOG_LEVEL:-info}
```

An optional value uses an explicit empty default, for example `${S3_BUCKET:-}`. Secret values, including `DATABASE_URL`, credentials, tokens, and private keys, must never be literal YAML values.

## Environment resolution

The local developer creates one ignored root `.env` file from the committed `.env.example`. All development scripts load that file. Docker Compose uses the same root file only for local Compose use; deployed containers receive values from their platform environment or secret manager.

YAML interpolation supports only `${NAME}` and `${NAME:-fallback}`. It resolves against the process environment after `.env` is loaded. A `${NAME}` reference whose value is absent or empty fails before Zod validation, naming both the variable and YAML module. `${NAME:-fallback}` uses the fallback only when the variable is absent or empty. Interpolation is single-pass: output is not interpreted again as a template. Environment values affect configuration only where a committed YAML module explicitly references them; there is no implicit global environment-to-config overlay.

## Validation and process boundaries

The loader returns the merged, interpolated object to the existing runtime config factories. `createApiConfig`, `createWorkerConfig`, `createSchedulerConfig`, and `createRealtimeConfig` retain ownership of their Zod schemas and derived values. Validation occurs after all selected modules merge and interpolation completes. Existing production safeguards remain: no server process may silently obtain a development database default in production.

Selecting a module is independent from exposing its values. A web server may select `realtime.yaml` to configure server behaviour, but only explicit `NEXT_PUBLIC_*` values may be bundled for browser code. The Next.js build must receive resolved public values before compilation; server-only values must remain server-only.

## Loader and runtime integration

`@repo/config` owns a filesystem loader and a small command wrapper. Development scripts start the wrapper through Bun with the single root `.env` file; deployment platforms provide the wrapper's process environment directly. The wrapper selects YAML modules, resolves them against that environment, then starts the target runtime with the resolved keys in its environment. Runtime factories perform the final Zod validation inside the child process. Keeping the final values in the child process environment lets the current API, worker, scheduler, realtime, Prisma, and Next.js integrations retain their standard configuration interfaces.

The web wrapper must run before `next dev` and `next build`, so `NEXT_PUBLIC_*` values are available for Next's compile-time replacement. The standalone API, worker, scheduler, and realtime commands use the same wrapper. Container images copy the committed `config/` directory and invoke the wrapper at runtime where applicable; the web image also invokes it during the build stage for public values.

## Repository changes

- Add the committed configuration modules and a root `.env.example`; remove the runtime-specific example files.
- Add a direct YAML parser dependency to `@repo/config`; do not rely on the transitive `js-yaml` package in the lockfile.
- Replace `--env-file=../../.env.<runtime>` scripts with one `.env` plus the configuration wrapper.
- Update Dockerfiles and Compose references from `.env.<runtime>` to `.env`, preserving platform environment precedence.
- Update `README.md` and `.agent/config.md` to document composition, interpolation, secret handling, and the Next.js public-value constraint.

## Testing

Unit tests cover merge order, nested merge, array replacement, missing modules, required interpolation failure, default interpolation, optional empty values, and preservation of non-interpolated scalar types. Runtime config tests prove each selected module set produces valid configuration and that invalid/missing required values fail. A web-focused test verifies the resolved public application URL is available to the existing Eden client configuration, while a server-only secret is absent from client-facing configuration.

Focused tests run before repository verification. The final verification is `rtk task quality` and `rtk task build`.
