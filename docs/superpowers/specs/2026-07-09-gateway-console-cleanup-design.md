# Gateway Console Cleanup Design

## Context

This project started from `codelifynet/turbostack-lite`. The current repo still carries a broad starter-kit surface: marketing pages, shadcn/Radix UI, billing, upload UI, demo panel pages, optional email/payment integrations, and multiple deployment assumptions.

The desired direction is a self-hosted backend gateway with a simple Next.js web console. The console should use Mantine directly and avoid carrying starter UI complexity.

## Decisions

- Product direction: backend gateway plus simple web console.
- Web UI: Mantine, not shadcn-ui.
- First phase auth: no login/auth gate.
- First screen: gateway console dashboard, not a landing page.
- Console layout: dashboard shell with a persistent sidebar on desktop and a drawer-style sidebar on small screens.
- Backend: Elysia remains the API runtime and should be reusable for other backend services.
- Deployment target: self-hosted server, with Docker/Compose as the default path.

## Web Console Scope

`apps/web` should be reduced to a small operational console:

- `Overview`: API health, database/service status, runtime summary, OpenAPI link.
- `Services`: configured backend services and their health state.
- `Activity`: recent request/check activity. In the first implementation this may be mock data or health-derived data.
- `Settings`: environment and API base URL visibility, plus deployment notes.

The console should use a dashboard-style layout with a left sidebar, top header area, and content region. The sidebar should contain the main navigation and remain visible on desktop. On mobile it should collapse behind a menu button.

The initial console should prioritize clear structure over complete gateway functionality. It should be useful as a foundation even before real service-management persistence exists.

## Web Cleanup

Remove or stop routing to starter-kit pages that are not part of the gateway console:

- marketing pages
- checkout and billing pages
- starter dashboard/demo pages
- upload UI pages
- shadcn-specific layout and theme plumbing

Replace shadcn dependencies with Mantine dependencies in `apps/web`. Mantine should be used directly in the web app first. A shared `packages/ui` package can be introduced later only if there are enough repeated app-specific components to justify it.

## API Contract Design

The current web app imports `type App` from the API entrypoint. That entrypoint also starts the server, which couples type imports to runtime side effects.

Refactor the API into separate units:

- `apps/api/src/app.ts`: exports `createApp()` and composes middleware/routes.
- `apps/api/src/server.ts`: imports `createApp()` and calls `.listen()`.
- `apps/api/src/types.ts`: exports the Elysia app type used by Eden clients.

`apps/web` should import only the app type needed for Eden. It must not import a file that starts the API server.

## Elysia Reuse

Route and plugin boundaries should support future backend services:

- keep health, system, and gateway-service routes separate
- keep CORS, logging, errors, OpenAPI, and rate-limit setup as composable plugins/helpers
- avoid gateway-specific logic in generic middleware
- keep service implementations out of route files when logic grows

The first implementation can keep existing routes where useful, but the shape should move toward app factory plus isolated route modules.

## Self-Hosted Deployment

The repo should provide a first-class self-hosted path:

- one root `docker-compose.yml` for `web`, `api`, and `postgres`
- consistent Dockerfiles using the lockfile that actually exists in the repo
- explicit ports: web `4100`, api `4101`, postgres internal default plus configurable host mapping
- documented env files for local and production self-hosting
- health checks for API and database where practical

Vercel/Railway-specific README content should be replaced or moved below the self-hosted flow.

## Package Update Strategy

Package updates should be done after the cleanup baseline is in place:

1. Establish build/typecheck on the cleaned app.
2. Remove unused starter dependencies.
3. Add Mantine packages.
4. Upgrade dependency groups in small batches.
5. Verify with `bun run check-types`, `bun run lint`, and `bun run build`.

This avoids debugging package upgrades and product cleanup at the same time.

## Non-Goals For Phase One

- no login/auth implementation
- no billing or subscription flow
- no UploadThing UI
- no reusable shared UI package unless required
- no full gateway persistence model unless needed to render the first service list
- no production reverse proxy automation beyond Docker/Compose basics

## Testing And Verification

Minimum verification for implementation:

- `bun install` completes with the updated lockfile
- `bun run check-types`
- `bun run lint`
- `bun run build`
- web console renders locally
- API health endpoint responds locally
- Docker/Compose build path is documented and smoke-tested if environment permits

## Open Implementation Notes

- Existing Better Auth code can remain in the backend temporarily if removing it creates unnecessary risk, but web should not depend on auth in phase one.
- Existing database package can remain, but the console should not require full seed/demo data to render.
- OpenAPI should stay available because it is useful for gateway operation and self-hosted inspection.
