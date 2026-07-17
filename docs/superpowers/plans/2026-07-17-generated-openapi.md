# Generated OpenAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and serve an OpenAPI 3 contract and Scalar documentation from Elysia route schemas.

**Architecture:** `apps/api/src/openapi.ts` owns plugin configuration and `apps/api/src/lib/docs-auth.ts` owns optional Basic authentication. `app.ts` gates only documentation paths and composes the plugin once.

**Tech Stack:** Elysia, `@elysiajs/openapi`, Bun test, Zod, `@t3-oss/env-core`.

---

## File structure

- Create: `apps/api/src/openapi.ts` and `apps/api/src/openapi.test.ts`.
- Create: `apps/api/src/lib/docs-auth.ts` and `apps/api/src/lib/docs-auth.test.ts`.
- Modify: `apps/api/package.json`, `apps/api/src/app.ts`, `packages/config/src/api.ts`, `packages/config/src/api.test.ts`, `.env.api.example`, `README.md`, `.agent/api.md`.

### Task 1: Configure optional documentation authentication

**Files:** `packages/config/src/api.ts`, `packages/config/src/api.test.ts`, `apps/api/src/lib/docs-auth.ts`, `apps/api/src/lib/docs-auth.test.ts`.

- [ ] **Step 1: Write failing tests**

```ts
test("requires a complete documentation credential pair", () => {
  expect(() => createApiConfig({ DATABASE_URL: url, OPENAPI_BASIC_AUTH_USERNAME: "docs" })).toThrow();
});

test("accepts matching Basic credentials", () => {
  expect(isDocumentationAuthorized(`Basic ${btoa("docs:secret")}`, "docs", "secret")).toBe(true);
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test packages/config/src/api.test.ts apps/api/src/lib/docs-auth.test.ts`  
Expected: FAIL because the keys and `isDocumentationAuthorized` do not exist.

- [ ] **Step 3: Implement the smallest boundary**

```ts
const apiServer = {
  ...commonServer,
  OPENAPI_BASIC_AUTH_USERNAME: z.string().min(1).optional(),
  OPENAPI_BASIC_AUTH_PASSWORD: z.string().min(1).optional(),
} as const;

export function isDocumentationAuthorized(authorization: string | undefined, username?: string, password?: string) {
  if (!username && !password) return true;
  if (!username || !password || !authorization?.startsWith("Basic ")) return false;
  const expected = Buffer.from(`${username}:${password}`);
  const actual = Buffer.from(authorization.slice(6), "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk bun test packages/config/src/api.test.ts apps/api/src/lib/docs-auth.test.ts`  
Expected: PASS.

```bash
git add packages/config/src/api.ts packages/config/src/api.test.ts apps/api/src/lib/docs-auth.ts apps/api/src/lib/docs-auth.test.ts
git commit -m "feat(api): add optional documentation authentication"
```

### Task 2: Expose generated documentation

**Files:** `apps/api/package.json`, `apps/api/src/openapi.ts`, `apps/api/src/app.ts`, `apps/api/src/openapi.test.ts`.

- [ ] **Step 1: Write failing endpoint tests**

```ts
test("serves generated OpenAPI JSON", async () => {
  const response = await app.handle(new Request("http://localhost:4101/api/openapi.json"));
  expect(response.status).toBe(200);
  expect((await response.json()).openapi).toMatch(/^3\./);
});

test("requires documentation credentials when configured", async () => {
  const response = await configuredApp.handle(new Request("http://localhost:4101/api/docs"));
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain("Basic");
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test apps/api/src/openapi.test.ts`  
Expected: FAIL with `404` because neither docs endpoint exists.

- [ ] **Step 3: Add `@elysiajs/openapi` and compose it once**

```ts
export const openapiPlugin = openapi({
  path: "/api/docs", specPath: "/api/openapi.json", provider: "scalar",
  scalar: { url: "/api/openapi.json" },
  documentation: { openapi: "3.0.3", info: { title: "API", version: "1.0.0" } },
});
```

In `app.ts`, return `401`, `WWW-Authenticate: Basic realm="API documentation"`, and the normal error envelope for unauthorised documentation paths; then call `.use(openapiPlugin)`.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk bun test apps/api/src/openapi.test.ts apps/api/src/app.test.ts`  
Expected: PASS.

```bash
git add apps/api/package.json apps/api/src/openapi.ts apps/api/src/app.ts apps/api/src/openapi.test.ts bun.lock
git commit -m "feat(api): generate OpenAPI documentation"
```

### Task 3: Document route metadata and configuration

**Files:** `.env.api.example`, `README.md`, `.agent/api.md`, `apps/api/src/routes/{health,status}.ts`.

- [ ] **Step 1: Add metadata to each baseline route**

```ts
.get("/health", handler, { detail: { tags: ["Health"], summary: "Check process health" } })
```

- [ ] **Step 2: Document endpoints and optional credential pair**

```md
Set both `OPENAPI_BASIC_AUTH_USERNAME` and `OPENAPI_BASIC_AUTH_PASSWORD` to protect `/api/docs` and `/api/openapi.json`; leave both unset for public local documentation.
```

- [ ] **Step 3: Verify and commit**

Run: `rtk task test:api && rtk task check-types:api`  
Expected: both commands exit `0`.

```bash
git add .env.api.example README.md .agent/api.md apps/api/src/routes
git commit -m "docs: describe generated API documentation"
```

