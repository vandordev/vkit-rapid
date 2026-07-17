# OpenAPI Server URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed API base URL to the generated OpenAPI specification consumed by Scalar.

**Architecture:** `@repo/config` validates `OPENAPI_SERVER_URL` for the API runtime. The Elysia OpenAPI plugin receives the materialized value and declares it in the OpenAPI `servers` array, while Scalar retains its same-origin relative specification URL.

**Tech Stack:** TypeScript, Zod, `@t3-oss/env-core`, Elysia OpenAPI, Bun test.

---

### Task 1: Expose the configured OpenAPI server URL

**Files:**
- Modify: `packages/config/src/api.ts`
- Modify: `packages/config/src/api.test.ts`
- Modify: `apps/api/src/openapi.ts`
- Modify: `apps/api/src/openapi.test.ts`
- Modify: `.env.api.example`
- Modify: `.env.web.example`

- [ ] **Step 1: Write failing configuration and OpenAPI tests**

```ts
expect(createApiConfig({ OPENAPI_SERVER_URL: "https://api.example.com" }).openapiServerUrl).toBe("https://api.example.com");

const document = await response.json();
expect(document.servers).toEqual([{ url: env.openapiServerUrl }]);
```

- [ ] **Step 2: Run tests to verify RED**

Run: `rtk bun test packages/config/src/api.test.ts apps/api/src/openapi.test.ts`

Expected: FAIL because the API config has no `openapiServerUrl` property and the OpenAPI document has no configured `servers` value.

- [ ] **Step 3: Add validated server-only configuration and OpenAPI metadata**

```ts
OPENAPI_SERVER_URL: z.string().url().default("http://localhost:4101"),

return { ...parsed, openapiServerUrl: parsed.OPENAPI_SERVER_URL };
```

```ts
export function createOpenapiPlugin(serverUrl: string) {
  return openapi({
    // existing paths and Scalar configuration
    documentation: { servers: [{ url: serverUrl }] },
  });
}
```

Use the API runtime configuration to instantiate the plugin. Add `OPENAPI_SERVER_URL` to the API and embedded-web environment examples with their appropriate local defaults.

- [ ] **Step 4: Run focused GREEN verification**

Run: `rtk bun test packages/config/src/api.test.ts apps/api/src/openapi.test.ts && rtk turbo run check-types --filter=@repo/config --filter=@repo/api`

Expected: all tests and both typechecks pass.

- [ ] **Step 5: Run repository verification and commit**

Run: `rtk task quality && rtk task build`

Expected: all commands exit `0`.

```bash
git add packages/config/src/api.ts packages/config/src/api.test.ts apps/api/src/openapi.ts apps/api/src/openapi.test.ts .env.api.example .env.web.example
git commit -m "feat(api): configure OpenAPI server URL"
```
