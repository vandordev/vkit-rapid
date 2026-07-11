# Inbound Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the environment-configured Oriskin webhook with database-managed, channel-aware inbound webhook destinations that receive fan-out delivery.

**Architecture:** Prisma stores active webhook destinations and seeds the current Oriskin endpoint. The buffer worker stores the SleekFlow `channel_id` and phone metadata alongside buffered text, looks up matching destinations during direct delivery or flush, and delivers the same payload to each target independently. `api_calls` records each attempt without coupling a batched delivery to a single message.

**Tech Stack:** Bun, TypeScript, Prisma 6, PostgreSQL, ioredis, native `fetch`, Bun test runner.

---

## File Structure

- `packages/database/prisma/schema.prisma`: declares `InboundDestination` and its database mapping.
- `packages/database/prisma/migrations/20260710000000_add_inbound_destinations/migration.sql`: creates the table, indexes it, and seeds Oriskin.
- `packages/database/src/repositories/inbound-destinations.ts`: exposes the sole query for active destinations matching a SleekFlow `channel_id`.
- `packages/database/src/repositories/inbound-destinations.test.ts`: verifies the repository query shape without a live database.
- `packages/database/src/index.ts`: exports the new repository and Prisma type.
- `apps/api/src/modules/buffer/worker.ts`: stores buffer metadata and fans out delivery with per-target logs.
- `apps/api/src/modules/buffer/__tests__/worker.test.ts`: covers matching, broadcast, isolation, and Redis fallback through injected dependencies.
- `apps/api/src/modules/messages/service.ts`: passes normalized `channelId` into buffering.
- `apps/api/src/lib/env.ts` and `apps/api/src/lib/env.test.ts`: remove obsolete env fields and verify parsing.
- `apps/api/.env.example`, `docker-compose.yml`, and `README.md`: remove forwarding environment configuration and document database-managed destinations.

### Task 1: Add Destination Persistence and Query

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260710000000_add_inbound_destinations/migration.sql`
- Create: `packages/database/src/repositories/inbound-destinations.ts`
- Create: `packages/database/src/repositories/inbound-destinations.test.ts`
- Modify: `packages/database/src/index.ts`

- [ ] **Step 1: Write the failing repository test**

Create `packages/database/src/repositories/inbound-destinations.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { listActiveInboundDestinations } from "./inbound-destinations";

describe("listActiveInboundDestinations", () => {
  test("returns global and matching channel destinations only", async () => {
    let query: unknown;
    const db = {
      inboundDestination: {
        findMany: async (args: unknown) => {
          query = args;
          return [];
        },
      },
    };

    await listActiveInboundDestinations("channel-wa-1", db as never);

    expect(query).toEqual({
      where: {
        isActive: true,
        OR: [{ channelId: null }, { channelId: "channel-wa-1" }],
      },
      orderBy: { createdAt: "asc" },
    });
  });

  test("returns only global destinations when the payload has no channel id", async () => {
    let query: unknown;
    const db = {
      inboundDestination: {
        findMany: async (args: unknown) => {
          query = args;
          return [];
        },
      },
    };

    await listActiveInboundDestinations(undefined, db as never);

    expect(query).toEqual({
      where: { isActive: true, OR: [{ channelId: null }] },
      orderBy: { createdAt: "asc" },
    });
  });
});
```

- [ ] **Step 2: Run the repository test and verify it fails**

Run: `bun test packages/database/src/repositories/inbound-destinations.test.ts`

Expected: FAIL because `./inbound-destinations` does not exist.

- [ ] **Step 3: Add the Prisma model and migration**

Add this model after `ApiCall` in `packages/database/prisma/schema.prisma`:

```prisma
model InboundDestination {
  id         String   @id @default(uuid()) @db.Uuid
  name       String   @unique
  webhookUrl String   @map("webhook_url")
  isActive   Boolean  @default(true) @map("is_active")
  channelId  String?  @map("channel_id")
  headers    Json?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("inbound_destinations")
  @@index([channelId], map: "inbound_destinations_channel_id_idx")
}
```

Create `packages/database/prisma/migrations/20260710000000_add_inbound_destinations/migration.sql`:

```sql
CREATE TABLE "inbound_destinations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "channel_id" TEXT,
    "headers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_destinations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbound_destinations_name_key" ON "inbound_destinations"("name");
CREATE INDEX "inbound_destinations_channel_id_idx" ON "inbound_destinations"("channel_id");

INSERT INTO "inbound_destinations" (
    "id", "name", "webhook_url", "is_active", "created_at", "updated_at"
) VALUES (
    '9a42e663-2ad6-4e9f-a1b8-d46524f069a3',
    'Oriskin Chatbot',
    'https://chatbot-api.oriskin.co.id/webhook/incoming-messages-sleekflow',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("name") DO NOTHING;
```

Run: `cd packages/database && bunx prisma generate`

Expected: Prisma Client generation succeeds and exposes `prisma.inboundDestination`.

- [ ] **Step 4: Implement and export the repository**

Create `packages/database/src/repositories/inbound-destinations.ts`:

```ts
import type { InboundDestination } from "@prisma/client";
import { prisma, type DatabaseClient } from "../client";

export async function listActiveInboundDestinations(
  channelId?: string,
  db: DatabaseClient = prisma,
): Promise<InboundDestination[]> {
  return db.inboundDestination.findMany({
    where: {
      isActive: true,
      OR: [
        { channelId: null },
        ...(channelId ? [{ channelId }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}
```

Add these exports in `packages/database/src/index.ts`:

```ts
export * from "./repositories/inbound-destinations";
export type { ApiCall, Contact, Conversation, InboundDestination, Message } from "@prisma/client";
```

- [ ] **Step 5: Run focused validation and commit**

Run:

```bash
bun test packages/database/src/repositories/inbound-destinations.test.ts
bun run check-types
```

Expected: both commands exit with status 0.

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260710000000_add_inbound_destinations/migration.sql packages/database/src/repositories/inbound-destinations.ts packages/database/src/repositories/inbound-destinations.test.ts packages/database/src/index.ts
git commit -m "feat: add inbound destinations"
```

### Task 2: Fan Out Buffered Inbound Messages

**Files:**
- Modify: `apps/api/src/modules/buffer/worker.ts`
- Modify: `apps/api/src/modules/buffer/__tests__/worker.test.ts`
- Modify: `apps/api/src/modules/messages/service.ts`

- [ ] **Step 1: Write failing worker tests for fan-out and matching**

Extend `apps/api/src/modules/buffer/__tests__/worker.test.ts` with a fake destination lookup and fetch function. Test `forwardToDestinations` with these cases:

```ts
test("posts the same payload to every matching destination", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  await forwardToDestinations(
    { channel: "whatsapp", channelId: "wa-1", primaryIdentifier: "phone:6281", phone: "6281", message: "halo" },
    {
      listDestinations: async () => [
        { id: "1", name: "A", webhookUrl: "https://a.example/webhook", headers: null },
        { id: "2", name: "B", webhookUrl: "https://b.example/webhook", headers: { "X-Tenant": "beta" } },
      ],
      createApiCall: async () => ({}),
      fetch: async (url, init) => {
        requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response("ok", { status: 200 });
      },
    },
  );

  expect(requests).toEqual([
    { url: "https://a.example/webhook", body: { customer_phone: "6281", customer_identifier: "phone:6281", channel: "whatsapp", message: "halo" } },
    { url: "https://b.example/webhook", body: { customer_phone: "6281", customer_identifier: "phone:6281", channel: "whatsapp", message: "halo" } },
  ]);
});

test("continues delivery after one destination fails", async () => {
  const attempted: string[] = [];
  await forwardToDestinations(
    { channel: "instagram", primaryIdentifier: "external:ig-1", message: "halo" },
    {
      listDestinations: async () => [
        { id: "1", name: "fails", webhookUrl: "https://fails.example", headers: null },
        { id: "2", name: "works", webhookUrl: "https://works.example", headers: null },
      ],
      createApiCall: async () => ({}),
      fetch: async (url) => {
        attempted.push(String(url));
        if (String(url).includes("fails")) throw new Error("network error");
        return new Response("ok", { status: 200 });
      },
    },
  );

  expect(attempted).toEqual(["https://fails.example", "https://works.example"]);
});
```

Add a test where `bufferOrForwardMessage` receives `{ redis: undefined }` and confirms the same delivery dependency is called. Add a flush test whose stored value contains `{ messages: ["halo", "lagi"], channelId: "wa-1", phone: "6281" }` and asserts that the delivery input preserves those fields.

- [ ] **Step 2: Run the worker tests and verify they fail**

Run: `bun test apps/api/src/modules/buffer/__tests__/worker.test.ts`

Expected: FAIL because `forwardToDestinations` and injectable delivery dependencies do not exist.

- [ ] **Step 3: Implement fan-out delivery and metadata-preserving buffers**

Replace the Oriskin-specific function in `apps/api/src/modules/buffer/worker.ts` with these boundaries:

```ts
import {
  createApiCall,
  listActiveInboundDestinations,
  type InboundDestination,
} from "@repo/database";

export type BufferedMessage = {
  channel: string;
  channelId?: string;
  primaryIdentifier: string;
  phone?: string;
  message: string;
};

type StoredBuffer = Pick<BufferedMessage, "channelId" | "phone"> & { messages: string[] };

export type DeliveryDependencies = {
  listDestinations: (channelId?: string) => Promise<InboundDestination[]>;
  createApiCall: typeof createApiCall;
  fetch: typeof fetch;
};

const defaultDeliveryDependencies: DeliveryDependencies = {
  listDestinations: listActiveInboundDestinations,
  createApiCall,
  fetch,
};
```

Implement `forwardToDestinations(input, dependencies = defaultDeliveryDependencies)` to query `dependencies.listDestinations(input.channelId)`, build the existing payload once, and call `Promise.allSettled` over the destinations. Each request uses `{ "Content-Type": "application/json", ...destination.headers }`; reject non-object `headers` values by treating them as `{}`. For every response, call `createApiCall` with `operation: "forward_inbound"`, the destination URL, the sent payload, and its status. For a thrown request, create the same log with `error` set to the error message. For a non-OK response, log a warning but do not throw.

Change buffer storage from `string[]` to `StoredBuffer`:

```ts
const stored: StoredBuffer = existing
  ? parseStoredBuffer(existing)
  : { messages: [], channelId: input.channelId, phone: input.phone };

stored.messages.push(input.message);
stored.channelId ??= input.channelId;
stored.phone ??= input.phone;
await redis.set(key, JSON.stringify(stored), "EX", getRandomTtlSeconds());
```

`parseStoredBuffer` must accept legacy `string[]` values and return `{ messages: parsed }`, so messages buffered before deployment remain deliverable. During flush, restore `channelId` and `phone` from `StoredBuffer` and pass them into `forwardToDestinations`.

Give `bufferOrForwardMessage` and `flushDueBuffers` an optional second parameter containing `{ redis?: Redis; delivery?: DeliveryDependencies }`. Use `options.redis ?? getRedisClient()` only when the caller did not explicitly supply `redis: undefined`; this lets tests exercise the Redis-unavailable fallback. Always start the buffer interval in `startBufferWorker`; the worker now decides at delivery time whether active database destinations exist.

- [ ] **Step 4: Pass `channelId` from the inbound service**

Update the `bufferOrForwardMessage` call in `apps/api/src/modules/messages/service.ts`:

```ts
forwardingStatus = await bufferOrForwardMessage({
  channel: normalized.channel,
  channelId: normalized.channelId,
  primaryIdentifier: identity.primaryIdentifier,
  phone: normalized.contact.phone,
  message: normalized.messageContent,
});
```

- [ ] **Step 5: Run worker and service tests, typecheck, then commit**

Run:

```bash
bun test apps/api/src/modules/buffer/__tests__/worker.test.ts
bun test apps/api/src/modules/messages/__tests__/service.test.ts
bun run check-types
```

Expected: all commands exit with status 0.

```bash
git add apps/api/src/modules/buffer/worker.ts apps/api/src/modules/buffer/__tests__/worker.test.ts apps/api/src/modules/messages/service.ts
git commit -m "feat: fan out inbound destinations"
```

### Task 3: Remove Obsolete Environment Configuration

**Files:**
- Modify: `apps/api/src/lib/env.ts`
- Create: `apps/api/src/lib/env.test.ts`
- Modify: `apps/api/.env.example`
- Modify: `docker-compose.yml`
- Modify: `README.md`

- [ ] **Step 1: Write the failing environment test**

Export `envSchema` from `apps/api/src/lib/env.ts`, then create `apps/api/src/lib/env.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { envSchema } from "./env";

describe("envSchema", () => {
  test("does not expose inbound forwarding environment settings", () => {
    const parsed = envSchema.parse({});

    expect(parsed).not.toHaveProperty("ORISKIN_WEBHOOK_URL");
    expect(parsed).not.toHaveProperty("ORISKIN_FORWARDING_ENABLED");
  });
});
```

- [ ] **Step 2: Run the environment test and verify it fails**

Run: `bun test apps/api/src/lib/env.test.ts`

Expected: FAIL because `envSchema` is not exported and the two obsolete fields still exist.

- [ ] **Step 3: Remove the configuration from runtime and deployment files**

In `apps/api/src/lib/env.ts`, change `const envSchema` to `export const envSchema` and delete the complete `ORISKIN_WEBHOOK_URL` and `ORISKIN_FORWARDING_ENABLED` schema entries. Delete the `# Oriskin forwarding` block from `apps/api/.env.example`. Delete both matching API environment lines from `docker-compose.yml`.

In `README.md`, replace the sentence about forwarding inbound text to Oriskin with: `Redis buffers inbound text messages before the worker broadcasts them to active database-managed destinations.` Remove both Oriskin variables from the required integration variables list and add one sentence that the migration seeds the initial `Oriskin Chatbot` destination.

- [ ] **Step 4: Run full validation and commit**

Run:

```bash
bun test apps/api/src/lib/env.test.ts
bun test apps/api/src/modules/buffer/__tests__/worker.test.ts
bun run check-types
bun run lint
```

Expected: all commands exit with status 0.

```bash
git add apps/api/src/lib/env.ts apps/api/src/lib/env.test.ts apps/api/.env.example docker-compose.yml README.md
git commit -m "chore: remove inbound forwarding env config"
```

### Task 4: Apply Migration and Verify the Complete Flow

**Files:**
- Verify only: files changed in Tasks 1-3

- [ ] **Step 1: Apply the committed migration in a development database**

Run: `cd packages/database && bunx prisma migrate deploy`

Expected: migration `20260710000000_add_inbound_destinations` applies and the `inbound_destinations` table contains the active `Oriskin Chatbot` row.

- [ ] **Step 2: Verify generated database API and full test suite**

Run:

```bash
cd packages/database && bunx prisma generate
cd ../..
bun test apps/api/src/lib/env.test.ts apps/api/src/modules/buffer/__tests__/worker.test.ts packages/database/src/repositories/inbound-destinations.test.ts
bun run check-types
bun run lint
bun run build
```

Expected: all commands exit with status 0.

- [ ] **Step 3: Inspect the final diff and commit any verification-only fix**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and no unintended files. If verification required a source correction, commit only that correction with `fix: stabilize inbound destination delivery`.

## Plan Self-Review

- Spec coverage: Task 1 implements storage, filtering, seed data, and headers. Task 2 implements one-time buffering, fan-out, failure isolation, direct fallback, payload preservation, and `api_calls` logs. Task 3 removes all obsolete routing environment configuration and updates documentation. Task 4 verifies migration and repository-wide behavior.
- Placeholder scan: no incomplete implementation markers or generic test instructions remain.
- Type consistency: the Prisma model is `InboundDestination`; the lookup is `listActiveInboundDestinations`; the worker entry point is `forwardToDestinations`; buffer metadata uses `channelId` and `phone` consistently.
