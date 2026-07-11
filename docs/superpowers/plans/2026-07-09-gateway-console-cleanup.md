# Gateway Console Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the starter-kit repo into a self-hosted Elysia gateway API with a simple Mantine Next.js dashboard console that uses a sidebar layout.

**Architecture:** Split the Elysia app factory from the server runtime so the Next.js app can import Eden types without starting the API server. Replace the broad starter Next.js UI with a small Mantine dashboard shell containing Overview, Services, Activity, and Settings sections. Keep deployment self-hosted first with Docker Compose for web, API, and Postgres.

**Tech Stack:** Bun, Turborepo, Elysia, Eden Treaty, Next.js App Router, React 19, Mantine, TypeScript, Docker Compose, PostgreSQL.

---

## File Structure

- Modify `apps/api/src/index.ts`: convert to compatibility re-export or remove after imports are updated.
- Create `apps/api/src/app.ts`: app factory, middleware, OpenAPI, root endpoint, and route mounting.
- Create `apps/api/src/server.ts`: runtime entrypoint that calls `.listen()`.
- Create `apps/api/src/types.ts`: exported Eden app type.
- Create `apps/api/src/routes/gateway.ts`: mock gateway service and activity endpoints for the first console.
- Modify `apps/api/src/routes/index.ts`: export gateway routes.
- Modify `apps/api/package.json`: scripts point to `src/server.ts`.
- Modify `apps/web/package.json`: remove starter UI dependencies and add Mantine.
- Modify `apps/web/next.config.mjs`: remove shadcn optimization/transpile entries and keep API rewrite.
- Delete or ignore `apps/web/proxy.ts`: remove auth gating for phase one.
- Replace `apps/web/app/layout.tsx`: Mantine provider shell root.
- Replace `apps/web/app/page.tsx`: dashboard console entry.
- Replace `apps/web/app/globals.css`: small Mantine-compatible global CSS.
- Create `apps/web/components/app-shell.tsx`: responsive sidebar dashboard layout.
- Create `apps/web/components/overview-panel.tsx`: health/status cards.
- Create `apps/web/components/services-panel.tsx`: service table/cards.
- Create `apps/web/components/activity-panel.tsx`: recent gateway activity list.
- Create `apps/web/components/settings-panel.tsx`: environment and endpoint information.
- Create `apps/web/lib/gateway-data.ts`: typed fetch helpers and fallback data.
- Create `docker-compose.yml`: self-hosted web/api/postgres stack.
- Modify `Dockerfile.api` and `Dockerfile.web`: align lockfile and entrypoints.
- Modify `README.md`: make self-hosted gateway console the primary setup path.

## Task 1: Preserve Baseline And Confirm Current Failures

**Files:**
- Inspect: `package.json`
- Inspect: `apps/api/package.json`
- Inspect: `apps/web/package.json`

- [ ] **Step 1: Check repo status**

Run:

```bash
rtk git status --short
```

Expected: the imported starter files may still be untracked, and the committed spec/plan files should be visible in git history. Do not revert untracked starter files.

- [ ] **Step 2: Run current typecheck**

Run:

```bash
rtk bun run check-types
```

Expected: this may fail on the starter baseline. Capture the first concrete failure in the task notes before changing code.

- [ ] **Step 3: Commit only if baseline artifacts changed**

If this task only inspected the repo, do not commit. If a generated file changed unexpectedly, inspect it and either keep it only if required or leave it unstaged.

## Task 2: Split Elysia App Factory From Server Runtime

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/types.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Extract the API builder**

Move the current app composition from `apps/api/src/index.ts` into `apps/api/src/app.ts`.

Required shape:

```ts
import { Elysia } from "elysia";

export const createApp = () =>
  new Elysia()
    // keep existing request blocking, request id, CORS, error handler,
    // OpenAPI protection, route mounting, and root endpoint here
    .get("/", () => ({
      success: true,
      data: {
        name: "SleekFlow Gateway API",
        version: "0.1.0",
        documentation: "/openapi",
      },
    }));
```

Keep all existing middleware behavior that is still needed by the current routes. Do not call `.listen()` in `app.ts`.

- [ ] **Step 2: Create the server runtime**

Write `apps/api/src/server.ts`:

```ts
import { createApp } from "./app";
import { env } from "@api/lib/env";

const app = createApp().listen(env.PORT);

console.log(`
SleekFlow Gateway API
Local:        http://localhost:${env.PORT}
Environment:  ${env.NODE_ENV}
OpenAPI:      http://localhost:${env.PORT}/openapi
`);

export type Server = typeof app;
```

- [ ] **Step 3: Create Eden type export**

Write `apps/api/src/types.ts`:

```ts
import { createApp } from "./app";

export type App = ReturnType<typeof createApp>;
```

- [ ] **Step 4: Keep index as compatibility export**

Replace `apps/api/src/index.ts` with:

```ts
export { createApp } from "./app";
export type { App } from "./types";
```

- [ ] **Step 5: Update API scripts**

In `apps/api/package.json`, update scripts:

```json
{
  "dev": "bun run --watch src/server.ts",
  "build": "bun build src/server.ts --outdir=dist --target=bun --external @prisma/client --external @repo/database",
  "start": "bun run dist/server.js"
}
```

Keep the existing `lint`, `check-types`, and `clean` scripts.

- [ ] **Step 6: Verify API typecheck**

Run:

```bash
rtk bun run check-types --filter=api
```

Expected: no error caused by importing `App` types. If existing unrelated route errors appear, capture them and fix only if they block the split.

- [ ] **Step 7: Commit**

Run:

```bash
rtk git add apps/api/src/app.ts apps/api/src/server.ts apps/api/src/types.ts apps/api/src/index.ts apps/api/package.json
rtk git commit -m "refactor(api): split app factory from server runtime"
```

## Task 3: Add Gateway Console API Endpoints

**Files:**
- Create: `apps/api/src/routes/gateway.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Create gateway routes**

Write `apps/api/src/routes/gateway.ts`:

```ts
import { Elysia, t } from "elysia";

const checkedAt = () => new Date().toISOString();

export const gatewayRoutes = new Elysia({ prefix: "/gateway", tags: ["Gateway"] })
  .get(
    "/services",
    () => ({
      success: true,
      data: [
        {
          id: "sleekflow-api",
          name: "SleekFlow API",
          baseUrl: "https://api.sleekflow.io",
          status: "online",
          latencyMs: 128,
          checkedAt: checkedAt(),
        },
        {
          id: "internal-worker",
          name: "Internal Worker",
          baseUrl: "http://localhost:4200",
          status: "degraded",
          latencyMs: 412,
          checkedAt: checkedAt(),
        },
      ],
    }),
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            baseUrl: t.String(),
            status: t.Union([t.Literal("online"), t.Literal("degraded"), t.Literal("offline")]),
            latencyMs: t.Number(),
            checkedAt: t.String(),
          }),
        ),
      }),
    },
  )
  .get(
    "/activity",
    () => ({
      success: true,
      data: [
        {
          id: "evt_001",
          service: "SleekFlow API",
          method: "GET",
          path: "/contacts",
          statusCode: 200,
          durationMs: 141,
          createdAt: checkedAt(),
        },
        {
          id: "evt_002",
          service: "Internal Worker",
          method: "POST",
          path: "/jobs/sync",
          statusCode: 202,
          durationMs: 389,
          createdAt: checkedAt(),
        },
      ],
    }),
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Array(
          t.Object({
            id: t.String(),
            service: t.String(),
            method: t.String(),
            path: t.String(),
            statusCode: t.Number(),
            durationMs: t.Number(),
            createdAt: t.String(),
          }),
        ),
      }),
    },
  );
```

- [ ] **Step 2: Export route**

Add this to `apps/api/src/routes/index.ts`:

```ts
export { gatewayRoutes } from "./gateway";
```

- [ ] **Step 3: Mount route**

In `apps/api/src/app.ts`, import `gatewayRoutes` from `@api/routes` and mount it inside the existing `/api` group:

```ts
.use(gatewayRoutes)
```

Place it near health/system routes, not inside auth-only route groups.

- [ ] **Step 4: Verify endpoint typecheck**

Run:

```bash
rtk bun run check-types --filter=api
```

Expected: API typecheck passes or reports only pre-existing unrelated errors.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/api/src/routes/gateway.ts apps/api/src/routes/index.ts apps/api/src/app.ts
rtk git commit -m "feat(api): add gateway console endpoints"
```

## Task 4: Replace Web Dependencies With Mantine

**Files:**
- Modify: `apps/web/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Remove starter UI dependencies from web**

From `apps/web/package.json`, remove dependencies that are only needed by the starter UI:

```text
@codemirror/lang-html
@codemirror/language
@codemirror/state
@codemirror/view
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
@floating-ui/dom
@floating-ui/react-dom
@repo/shadcn-ui
@shikijs/core
@shikijs/engine-javascript
@shikijs/types
@tiptap/extension-drag-handle
@tiptap/extension-drag-handle-react
@tiptap/extension-image
@tiptap/extension-link
@tiptap/extension-list
@tiptap/extension-node-range
@tiptap/extension-subscript
@tiptap/extension-superscript
@tiptap/extension-table
@tiptap/extension-text-align
@tiptap/extension-text-style
@tiptap/extension-youtube
@tiptap/extensions
@tiptap/pm
@tiptap/react
@tiptap/starter-kit
@tiptap/suggestion
@uploadthing/react
codemirror
framer-motion
highlight.js
lowlight
motion
prosemirror-highlight
react-colorful
react-easy-crop
react-icons
react-markdown
react-window
rehype-highlight
remark-gfm
shiki
tippy.js
tunnel-rat
tw-animate-css
```

Keep `@elysiajs/eden`, `@t3-oss/env-nextjs`, `elysia`, `jose`, `lucide-react`, `next`, `react`, `react-dom`, `server-only`, `zod`, and `zustand` if still imported.

- [ ] **Step 2: Add Mantine dependencies**

Add to `apps/web/package.json` dependencies:

```json
{
  "@mantine/core": "^8.3.9",
  "@mantine/hooks": "^8.3.9",
  "@mantine/notifications": "^8.3.9"
}
```

- [ ] **Step 3: Install**

Run:

```bash
rtk bun install
```

Expected: `bun.lock` updates successfully.

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add apps/web/package.json bun.lock
rtk git commit -m "chore(web): replace starter ui dependencies with mantine"
```

## Task 5: Build Mantine Dashboard Shell With Sidebar

**Files:**
- Replace: `apps/web/app/layout.tsx`
- Replace: `apps/web/app/page.tsx`
- Replace: `apps/web/app/globals.css`
- Create: `apps/web/components/app-shell.tsx`
- Create: `apps/web/components/overview-panel.tsx`
- Create: `apps/web/components/services-panel.tsx`
- Create: `apps/web/components/activity-panel.tsx`
- Create: `apps/web/components/settings-panel.tsx`
- Create: `apps/web/lib/gateway-data.ts`
- Delete: `apps/web/proxy.ts`

- [ ] **Step 1: Remove auth proxy**

Delete `apps/web/proxy.ts`. Phase one has no login gate.

- [ ] **Step 2: Replace global CSS**

Write `apps/web/app/globals.css`:

```css
html,
body {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--mantine-color-gray-0);
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Replace root layout**

Write `apps/web/app/layout.tsx`:

```tsx
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "./globals.css";

export const metadata: Metadata = {
  title: "SleekFlow Gateway",
  description: "Self-hosted gateway operations console",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light">
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Add typed gateway data helpers**

Write `apps/web/lib/gateway-data.ts` with typed fetch helpers for `/health`, `/api/gateway/services`, and `/api/gateway/activity`. Include fallback data if a fetch fails so the console still renders during local setup.

Use this exported shape:

```ts
export type GatewayService = {
  id: string;
  name: string;
  baseUrl: string;
  status: "online" | "degraded" | "offline";
  latencyMs: number;
  checkedAt: string;
};

export type GatewayActivity = {
  id: string;
  service: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
};
```

- [ ] **Step 5: Create sidebar app shell**

Write `apps/web/components/app-shell.tsx` as a client component using Mantine `AppShell`, `Burger`, `NavLink`, `Group`, `Title`, `Text`, and `Badge`.

Navigation labels:

```ts
const navItems = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;
```

The sidebar must be visible on desktop and collapse to a burger-controlled drawer on mobile.

- [ ] **Step 6: Create dashboard panels**

Create the four panel components:

```text
apps/web/components/overview-panel.tsx
apps/web/components/services-panel.tsx
apps/web/components/activity-panel.tsx
apps/web/components/settings-panel.tsx
```

Use Mantine components only. Avoid shadcn imports.

- [ ] **Step 7: Replace page**

Write `apps/web/app/page.tsx` as an async server component:

```tsx
import { GatewayShell } from "@/components/app-shell";
import {
  getGatewayActivity,
  getGatewayHealth,
  getGatewayServices,
} from "@/lib/gateway-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [health, services, activity] = await Promise.all([
    getGatewayHealth(),
    getGatewayServices(),
    getGatewayActivity(),
  ]);

  return (
    <GatewayShell
      health={health}
      services={services}
      activity={activity}
    />
  );
}
```

- [ ] **Step 8: Verify no shadcn imports remain in active web app**

Run:

```bash
rtk rg -n "@repo/shadcn-ui|shadcn" apps/web/app apps/web/components apps/web/lib
```

Expected: no output.

- [ ] **Step 9: Verify web typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: web typecheck passes after obsolete pages/components are removed or no longer included.

- [ ] **Step 10: Commit**

Run:

```bash
rtk git add apps/web
rtk git commit -m "feat(web): add mantine gateway dashboard shell"
```

## Task 6: Remove Obsolete Web Starter Surface

**Files:**
- Delete: `apps/web/app/(auth)`
- Delete: `apps/web/app/(marketing)`
- Delete: `apps/web/app/(panel)`
- Delete: `apps/web/app/checkout`
- Delete: starter-only components under `apps/web/components`
- Delete: starter-only services under `apps/web/services`
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: Delete unused route groups**

Remove these paths:

```bash
rtk rm -rf apps/web/app/'(auth)' apps/web/app/'(marketing)' apps/web/app/'(panel)' apps/web/app/checkout
```

- [ ] **Step 2: Delete starter-only component folders**

Remove component folders that only supported the old starter UI:

```bash
rtk rm -rf apps/web/components/auth apps/web/components/charts apps/web/components/data-table apps/web/components/landing apps/web/components/panel
```

Inspect remaining components before deleting them. Keep only files used by the Mantine console.

- [ ] **Step 3: Delete starter-only services**

Remove old frontend service wrappers if the new console does not import them:

```bash
rtk rm -rf apps/web/services
```

- [ ] **Step 4: Simplify next config**

In `apps/web/next.config.mjs`, remove `@repo/shadcn-ui` from `optimizePackageImports` and `transpilePackages`. Keep the `/api/:path*` rewrite to `NEXT_PUBLIC_API_URL`.

- [ ] **Step 5: Verify no deleted imports remain**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: passes.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add apps/web
rtk git commit -m "chore(web): remove starter routes and components"
```

## Task 7: Add Self-Hosted Compose Path

**Files:**
- Create: `docker-compose.yml`
- Modify: `Dockerfile.api`
- Modify: `Dockerfile.web`
- Modify: `apps/api/.env.example`
- Modify: `apps/web/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Fix Dockerfile lockfile references**

Ensure `Dockerfile.api` and `Dockerfile.web` copy `bun.lock`, not `bun.lockb`.

- [ ] **Step 2: API runtime command**

In `Dockerfile.api`, run the built server:

```dockerfile
CMD ["bun", "run", "apps/api/dist/server.js"]
```

If the Dockerfile chooses to run source directly for simpler first deployment, use:

```dockerfile
CMD ["bun", "run", "--bun", "apps/api/src/server.ts"]
```

Use one approach consistently and document it in the Dockerfile comment.

- [ ] **Step 3: Create Compose file**

Create root `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sleekflow_gateway
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5434:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d sleekflow_gateway"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      NODE_ENV: production
      PORT: 4101
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/sleekflow_gateway?schema=public
      CORS_ORIGIN: http://localhost:4100
      FRONTEND_URL: http://localhost:4100
    ports:
      - "4101:4101"
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    environment:
      NODE_ENV: production
      PORT: 4100
      HOSTNAME: 0.0.0.0
      NEXT_PUBLIC_API_URL: http://api:4101
    ports:
      - "4100:4100"
    depends_on:
      - api

volumes:
  postgres-data:
```

- [ ] **Step 4: Update env examples**

Make the examples match the self-hosted defaults:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/sleekflow_gateway?schema=public"
PORT=4101
CORS_ORIGIN="http://localhost:4100"
FRONTEND_URL="http://localhost:4100"
NEXT_PUBLIC_API_URL="http://localhost:4101"
```

Remove Polar, UploadThing, and OAuth examples from the primary section. Keep them only in an optional legacy section if they still exist in backend code.

- [ ] **Step 5: Rewrite README quick start**

README must lead with:

```bash
bun install
cp apps/api/.env.example .env
bun run dev
```

And self-hosted path:

```bash
docker compose up --build
```

Document:

```text
Web: http://localhost:4100
API: http://localhost:4101
OpenAPI: http://localhost:4101/openapi
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add Dockerfile.api Dockerfile.web docker-compose.yml apps/api/.env.example apps/web/.env.example README.md
rtk git commit -m "chore: add self-hosted deployment path"
```

## Task 8: Final Verification

**Files:**
- Inspect all changed files.

- [ ] **Step 1: Install dependencies**

Run:

```bash
rtk bun install
```

Expected: completes and lockfile is stable.

- [ ] **Step 2: Typecheck**

Run:

```bash
rtk bun run check-types
```

Expected: passes.

- [ ] **Step 3: Lint**

Run:

```bash
rtk bun run lint
```

Expected: passes.

- [ ] **Step 4: Build**

Run:

```bash
rtk bun run build
```

Expected: passes.

- [ ] **Step 5: Smoke run API**

Run:

```bash
rtk bun run dev:api
```

Expected: API starts on `http://localhost:4101`. In another terminal or after backgrounding the process, request:

```bash
rtk curl -s http://localhost:4101/health
```

Expected response contains:

```json
{"success":true}
```

- [ ] **Step 6: Smoke run web**

Run:

```bash
rtk bun run dev:web
```

Expected: web starts on `http://localhost:4100` and renders the Mantine dashboard with a sidebar containing `Overview`, `Services`, `Activity`, and `Settings`.

- [ ] **Step 7: Final status**

Run:

```bash
rtk git status --short
```

Expected: only intentional changes remain. Commit any final fix with a focused message.

## Self-Review

- Spec coverage: covers Mantine console, sidebar dashboard, no auth phase one, Elysia type/runtime split, gateway endpoints, and self-hosted deployment.
- Red-flag scan: no incomplete-marker terms or unspecified future-only steps remain.
- Type consistency: route data types match the web helper types and the Mantine panel data shape.
