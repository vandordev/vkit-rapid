# Optional Object Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in S3/MinIO package with server-only typed configuration and safe private-object defaults.

**Architecture:** `@repo/storage` receives a fully materialized config and never reads environment variables. `@repo/config` exports a reusable schema fragment that server runtimes compose; products define their own keys and delivery policy.

**Tech Stack:** AWS SDK v3, TypeScript, Zod, Bun test, `@t3-oss/env-core`.

---

## File structure

- Create: `packages/storage/{package.json,tsconfig.json,eslint.config.js}`.
- Create: `packages/storage/src/{types,keys,client,index}.ts` and focused tests.
- Create: `packages/config/src/storage.ts` and tests.
- Modify: `packages/config/src/{api,worker,index}.ts`, API/worker dependencies, env examples, README, `.agent/config.md`.

### Task 1: Establish the storage config contract

**Files:** `packages/config/src/storage.ts`, `packages/config/src/storage.test.ts`, `packages/config/src/{api,worker,index}.ts`.

- [ ] **Step 1: Write the failing config test**

```ts
test("maps optional S3 variables without exposing them to clients", () => {
  expect(createApiConfig({
    DATABASE_URL: url, S3_BUCKET: "uploads", S3_REGION: "ap-southeast-1",
    S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "secret",
  }).storage).toMatchObject({ bucket: "uploads", rootPrefix: "uploads" });
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test packages/config/src/storage.test.ts`  
Expected: FAIL because the storage schema and `storage` result do not exist.

- [ ] **Step 3: Implement the reusable server schema fragment**

```ts
export const storageServer = {
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ROOT_PREFIX: z.string().min(1).default("uploads"),
} as const;
```

Reject partial credentials and return `storage: null` only if all credential fields are absent.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk task test:config`  
Expected: PASS.

```bash
git add packages/config/src
git commit -m "feat(config): add optional object storage settings"
```

### Task 2: Build and test the S3-compatible client

**Files:** `packages/storage/src/{types,keys,client,index}.ts`, `packages/storage/src/{keys,client}.test.ts`, package manifests.

- [ ] **Step 1: Write failing key and validation tests**

```ts
test("builds a key below the configured root", () => {
  expect(buildObjectKey({ rootPrefix: "product-a", fileName: "résumé.pdf" })).toMatch(/^product-a\/uploads\//);
});
test("rejects a key outside the configured root", () => {
  expect(() => assertObjectKey("product-a", "other/file.pdf")).toThrow("outside configured prefix");
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test packages/storage/src/keys.test.ts packages/storage/src/client.test.ts`  
Expected: FAIL because `@repo/storage` does not exist.

- [ ] **Step 3: Implement the smallest package API**

```ts
export type StorageConfig = { bucket: string; region: string; accessKeyId: string; secretAccessKey: string; endpoint?: string; rootPrefix: string };
export type PutObjectInput = { key: string; body: Uint8Array; contentType: string };

export function createStorageClient(config: StorageConfig, client = new S3Client({ region: config.region, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}) })) {
  return {
    async put(input: PutObjectInput) { assertObjectKey(config.rootPrefix, input.key); await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: input.key, Body: input.body, ContentType: input.contentType })); },
    async get(key: string) { assertObjectKey(config.rootPrefix, key); return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key })); },
  };
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk bun test packages/storage && rtk turbo run check-types --filter=@repo/storage`  
Expected: both commands exit `0`.

```bash
git add packages/storage package.json bun.lock
git commit -m "feat(storage): add optional S3-compatible client"
```

### Task 3: Document server-only opt-in use

**Files:** `apps/api/package.json`, `apps/worker/package.json`, `.env.api.example`, `.env.worker.example`, `README.md`, `.agent/config.md`.

- [ ] **Step 1: Add storage only to server workspace dependencies**

```json
"@repo/storage": "*"
```

- [ ] **Step 2: Document explicit server-only settings**

```env
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=
S3_ROOT_PREFIX=uploads
```

- [ ] **Step 3: Verify and commit**

Run: `rtk task test:config && rtk bun test packages/storage && rtk task check-types`  
Expected: all commands exit `0`.

```bash
git add apps/api/package.json apps/worker/package.json .env.api.example .env.worker.example README.md .agent/config.md bun.lock
git commit -m "docs: describe optional object storage"
```

