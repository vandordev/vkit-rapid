# SleekFlow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Prisma-backed SleekFlow gateway that receives WhatsApp and Instagram inbound messages, sends outbound messages through SleekFlow, logs all message activity, and buffers inbound forwarding to Oriskin with Redis.

**Architecture:** Add a `packages/database` workspace package that owns Prisma schema, client access, and repositories. Add focused API modules for SleekFlow normalization/client/service/routes and Redis buffering; compatibility endpoints delegate to the same services as the new `/api/*` endpoints.

**Tech Stack:** Bun workspaces, Elysia, TypeScript, Prisma, PostgreSQL, Redis-compatible cache via `ioredis`, Bun test runner.

---

## File Map

- Create `packages/database/package.json`: workspace package scripts and exports.
- Create `packages/database/tsconfig.json`: TypeScript config for database package.
- Create `packages/database/prisma/schema.prisma`: Prisma datasource, generator, and SleekFlow models.
- Create `packages/database/src/client.ts`: singleton Prisma client.
- Create `packages/database/src/repositories/sleekflow.ts`: repository helpers for contacts, conversations, messages, and API calls.
- Create `packages/database/src/index.ts`: public exports.
- Modify `package.json`: add `@repo/database` workspace awareness through existing workspace glob only if needed; add no root scripts unless useful.
- Modify `apps/api/package.json`: add dependencies and test scripts.
- Modify `apps/api/src/lib/env.ts`: add database, SleekFlow, Redis, Oriskin, and auth env vars.
- Create `apps/api/src/lib/auth.ts`: bearer/query token helper.
- Create `apps/api/src/modules/sleekflow/types.ts`: normalized message and outbound request types.
- Create `apps/api/src/modules/sleekflow/normalizer.ts`: pure Flow Builder payload normalization.
- Create `apps/api/src/modules/sleekflow/client.ts`: SleekFlow HTTP API client.
- Create `apps/api/src/modules/buffer/redis.ts`: Redis client setup.
- Create `apps/api/src/modules/buffer/worker.ts`: buffering and periodic flush logic.
- Create `apps/api/src/modules/sleekflow/service.ts`: inbound/outbound orchestration.
- Create `apps/api/src/modules/sleekflow/routes.ts`: new `/api/*` and legacy compatibility routes.
- Modify `apps/api/src/routes/index.ts`: export SleekFlow routes.
- Modify `apps/api/src/app.ts`: mount SleekFlow routes and start buffer worker lifecycle.
- Modify `apps/api/.env.example`: document new env vars with redacted values.
- Modify `docker-compose.yml`: add Redis env and API env references; do not commit real secrets.
- Add tests under `apps/api/src/modules/**/__tests__/*.test.ts`.

## Task 1: Add Prisma Database Package

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/index.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add dependencies**

Run:

```bash
bun add @prisma/client --filter @repo/database
bun add -d prisma --filter @repo/database
bun add @repo/database --filter api
```

Expected: `packages/database/package.json`, `apps/api/package.json`, and `bun.lockb` update.

- [ ] **Step 2: Create package manifest**

Create `packages/database/package.json`:

```json
{
  "name": "@repo/database",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "check-types": "tsc --noEmit",
    "clean": "rm -rf node_modules/.prisma"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "*",
    "prisma": "^6.0.0",
    "typescript": "5.9.2"
  }
}
```

- [ ] **Step 3: Create TypeScript config**

Create `packages/database/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create Prisma schema**

Create `packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SleekflowMessageDirection {
  inbound
  outbound
}

model SleekflowContact {
  id                BigInt   @id @default(autoincrement())
  primaryIdentifier String
  channel           String
  phone             String?
  externalContactId String?
  channelIdentityId String?
  displayName       String?
  rawProfile        Json?
  firstSeenAt       DateTime @default(now())
  lastSeenAt        DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  conversations SleekflowConversation[]
  messages      SleekflowMessage[]

  @@unique([channel, primaryIdentifier])
  @@index([phone])
  @@index([channel])
  @@index([lastSeenAt])
}

model SleekflowConversation {
  id                      BigInt   @id @default(autoincrement())
  contactId               BigInt
  channel                 String
  sleekflowConversationId String
  lastMessageAt           DateTime?
  raw                     Json?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  contact  SleekflowContact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  messages SleekflowMessage[]

  @@unique([channel, sleekflowConversationId])
  @@index([contactId])
  @@index([lastMessageAt])
}

model SleekflowMessage {
  id                      BigInt                   @id @default(autoincrement())
  contactId               BigInt
  conversationId          BigInt?
  direction               SleekflowMessageDirection
  channel                 String
  messageType             String
  messageContent          String?
  sleekflowMessageId      String?
  sleekflowMessageUniqueId String?
  status                  String?
  fileName                String?
  fileUrl                 String?
  analyticTags            Json?
  rawPayload              Json?
  rawResponse             Json?
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt

  contact      SleekflowContact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  conversation SleekflowConversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  apiCalls     SleekflowApiCall[]

  @@index([contactId])
  @@index([conversationId])
  @@index([direction])
  @@index([channel])
  @@index([createdAt])
  @@index([sleekflowMessageId])
}

model SleekflowApiCall {
  id              BigInt   @id @default(autoincrement())
  messageId        BigInt?
  operation        String
  requestUrl       String
  requestPayload   Json?
  responseStatus   Int?
  responsePayload  Json?
  error            String?
  createdAt        DateTime @default(now())

  message SleekflowMessage? @relation(fields: [messageId], references: [id], onDelete: SetNull)

  @@index([messageId])
  @@index([operation])
  @@index([createdAt])
}
```

- [ ] **Step 5: Create Prisma client wrapper**

Create `packages/database/src/client.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type DatabaseClient = PrismaClient;
```

- [ ] **Step 6: Create public export**

Create `packages/database/src/index.ts`:

```ts
export { prisma } from "./client";
export type { DatabaseClient } from "./client";
export * from "@prisma/client";
```

- [ ] **Step 7: Generate Prisma client**

Run:

```bash
cd packages/database && bun run db:generate
```

Expected: command exits 0 and generated Prisma client is available.

- [ ] **Step 8: Typecheck package**

Run:

```bash
bun run check-types --filter @repo/database
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/database apps/api/package.json bun.lockb
git commit -m "feat: add prisma database package"
```

## Task 2: Add Database Repository Helpers

**Files:**
- Create: `packages/database/src/repositories/sleekflow.ts`
- Modify: `packages/database/src/index.ts`
- Test: `packages/database/src/repositories/sleekflow.test.ts`

- [ ] **Step 1: Write repository test**

Create `packages/database/src/repositories/sleekflow.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildContactIdentity } from "./sleekflow";

describe("buildContactIdentity", () => {
  test("uses phone number for WhatsApp contacts", () => {
    expect(
      buildContactIdentity({
        channel: "whatsappcloudapi",
        phone: "628123",
        externalContactId: undefined,
        channelIdentityId: "wa-channel",
        conversationId: "conv-1",
      }),
    ).toEqual({
      primaryIdentifier: "phone:628123",
      lookupValue: "628123",
    });
  });

  test("uses external contact id for Instagram when phone is missing", () => {
    expect(
      buildContactIdentity({
        channel: "instagram",
        phone: undefined,
        externalContactId: "ig-user-1",
        channelIdentityId: "ig-channel",
        conversationId: "conv-2",
      }),
    ).toEqual({
      primaryIdentifier: "external:ig-user-1",
      lookupValue: "ig-user-1",
    });
  });

  test("falls back to channel id then conversation id", () => {
    expect(
      buildContactIdentity({
        channel: "instagram",
        phone: undefined,
        externalContactId: undefined,
        channelIdentityId: "ig-channel",
        conversationId: "conv-3",
      }).primaryIdentifier,
    ).toBe("channel:ig-channel");
  });
});
```

- [ ] **Step 2: Run repository test and verify RED**

Run:

```bash
bun test packages/database/src/repositories/sleekflow.test.ts
```

Expected: FAIL because `./sleekflow` does not exist.

- [ ] **Step 3: Implement repository helpers**

Create `packages/database/src/repositories/sleekflow.ts`:

```ts
import type {
  Prisma,
  SleekflowApiCall,
  SleekflowContact,
  SleekflowConversation,
  SleekflowMessage,
  SleekflowMessageDirection,
} from "@prisma/client";
import { prisma, type DatabaseClient } from "../client";

export type ContactIdentityInput = {
  channel: string;
  phone?: string | null;
  externalContactId?: string | null;
  channelIdentityId?: string | null;
  conversationId?: string | null;
};

export type ContactIdentity = {
  primaryIdentifier: string;
  lookupValue: string;
};

export function buildContactIdentity(input: ContactIdentityInput): ContactIdentity {
  if (input.phone) {
    return { primaryIdentifier: `phone:${input.phone}`, lookupValue: input.phone };
  }

  if (input.externalContactId) {
    return {
      primaryIdentifier: `external:${input.externalContactId}`,
      lookupValue: input.externalContactId,
    };
  }

  if (input.channelIdentityId) {
    return {
      primaryIdentifier: `channel:${input.channelIdentityId}`,
      lookupValue: input.channelIdentityId,
    };
  }

  if (input.conversationId) {
    return {
      primaryIdentifier: `conversation:${input.conversationId}`,
      lookupValue: input.conversationId,
    };
  }

  return {
    primaryIdentifier: `unknown:${input.channel}`,
    lookupValue: input.channel,
  };
}

export type UpsertContactInput = ContactIdentityInput & {
  displayName?: string | null;
  rawProfile?: Prisma.InputJsonValue;
};

export async function upsertSleekflowContact(
  input: UpsertContactInput,
  db: DatabaseClient = prisma,
): Promise<SleekflowContact> {
  const identity = buildContactIdentity(input);

  return db.sleekflowContact.upsert({
    where: {
      channel_primaryIdentifier: {
        channel: input.channel,
        primaryIdentifier: identity.primaryIdentifier,
      },
    },
    update: {
      phone: input.phone ?? undefined,
      externalContactId: input.externalContactId ?? undefined,
      channelIdentityId: input.channelIdentityId ?? undefined,
      displayName: input.displayName ?? undefined,
      rawProfile: input.rawProfile ?? undefined,
      lastSeenAt: new Date(),
    },
    create: {
      channel: input.channel,
      primaryIdentifier: identity.primaryIdentifier,
      phone: input.phone ?? undefined,
      externalContactId: input.externalContactId ?? undefined,
      channelIdentityId: input.channelIdentityId ?? undefined,
      displayName: input.displayName ?? undefined,
      rawProfile: input.rawProfile ?? undefined,
    },
  });
}

export type UpsertConversationInput = {
  contactId: bigint;
  channel: string;
  sleekflowConversationId: string;
  raw?: Prisma.InputJsonValue;
  lastMessageAt?: Date;
};

export async function upsertSleekflowConversation(
  input: UpsertConversationInput,
  db: DatabaseClient = prisma,
): Promise<SleekflowConversation> {
  return db.sleekflowConversation.upsert({
    where: {
      channel_sleekflowConversationId: {
        channel: input.channel,
        sleekflowConversationId: input.sleekflowConversationId,
      },
    },
    update: {
      contactId: input.contactId,
      raw: input.raw,
      lastMessageAt: input.lastMessageAt ?? new Date(),
    },
    create: {
      contactId: input.contactId,
      channel: input.channel,
      sleekflowConversationId: input.sleekflowConversationId,
      raw: input.raw,
      lastMessageAt: input.lastMessageAt ?? new Date(),
    },
  });
}

export type CreateMessageInput = {
  contactId: bigint;
  conversationId?: bigint | null;
  direction: SleekflowMessageDirection;
  channel: string;
  messageType: string;
  messageContent?: string | null;
  sleekflowMessageId?: string | null;
  sleekflowMessageUniqueId?: string | null;
  status?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  analyticTags?: Prisma.InputJsonValue;
  rawPayload?: Prisma.InputJsonValue;
  rawResponse?: Prisma.InputJsonValue;
};

export async function createSleekflowMessage(
  input: CreateMessageInput,
  db: DatabaseClient = prisma,
): Promise<SleekflowMessage> {
  return db.sleekflowMessage.create({
    data: {
      contactId: input.contactId,
      conversationId: input.conversationId ?? undefined,
      direction: input.direction,
      channel: input.channel,
      messageType: input.messageType,
      messageContent: input.messageContent ?? undefined,
      sleekflowMessageId: input.sleekflowMessageId ?? undefined,
      sleekflowMessageUniqueId: input.sleekflowMessageUniqueId ?? undefined,
      status: input.status ?? undefined,
      fileName: input.fileName ?? undefined,
      fileUrl: input.fileUrl ?? undefined,
      analyticTags: input.analyticTags,
      rawPayload: input.rawPayload,
      rawResponse: input.rawResponse,
    },
  });
}

export type CreateApiCallInput = {
  messageId?: bigint | null;
  operation: string;
  requestUrl: string;
  requestPayload?: Prisma.InputJsonValue;
  responseStatus?: number | null;
  responsePayload?: Prisma.InputJsonValue;
  error?: string | null;
};

export async function createSleekflowApiCall(
  input: CreateApiCallInput,
  db: DatabaseClient = prisma,
): Promise<SleekflowApiCall> {
  return db.sleekflowApiCall.create({
    data: {
      messageId: input.messageId ?? undefined,
      operation: input.operation,
      requestUrl: input.requestUrl,
      requestPayload: input.requestPayload,
      responseStatus: input.responseStatus ?? undefined,
      responsePayload: input.responsePayload,
      error: input.error ?? undefined,
    },
  });
}

export async function listSleekflowContacts(limit = 100, db: DatabaseClient = prisma) {
  return db.sleekflowContact.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: {
          messages: true,
          conversations: true,
        },
      },
    },
  });
}

export async function getContactTimeline(
  identifier: string,
  limit = 100,
  db: DatabaseClient = prisma,
) {
  const contact = await db.sleekflowContact.findFirst({
    where: {
      OR: [
        { primaryIdentifier: identifier },
        { phone: identifier },
        { externalContactId: identifier },
        { channelIdentityId: identifier },
      ],
    },
  });

  if (!contact) {
    return null;
  }

  const messages = await db.sleekflowMessage.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { conversation: true },
  });

  return { contact, messages };
}

export async function listSleekflowConversations(limit = 100, db: DatabaseClient = prisma) {
  return db.sleekflowConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    include: {
      contact: true,
      _count: {
        select: { messages: true },
      },
    },
  });
}
```

- [ ] **Step 4: Export repository**

Modify `packages/database/src/index.ts`:

```ts
export { prisma } from "./client";
export type { DatabaseClient } from "./client";
export * from "./repositories/sleekflow";
export * from "@prisma/client";
```

- [ ] **Step 5: Run test and typecheck**

Run:

```bash
bun test packages/database/src/repositories/sleekflow.test.ts
bun run check-types --filter @repo/database
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add packages/database
git commit -m "feat: add sleekflow database repositories"
```

## Task 3: Add API Environment and Auth Helpers

**Files:**
- Modify: `apps/api/src/lib/env.ts`
- Create: `apps/api/src/lib/auth.ts`
- Test: `apps/api/src/lib/auth.test.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Write auth test**

Create `apps/api/src/lib/auth.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { getProvidedToken, isTokenAuthorized } from "./auth";

describe("auth helpers", () => {
  test("reads bearer token", () => {
    expect(getProvidedToken("Bearer abc", undefined)).toBe("abc");
  });

  test("uses query token when bearer token is absent", () => {
    expect(getProvidedToken("", "query-token")).toBe("query-token");
  });

  test("rejects wrong token", () => {
    expect(isTokenAuthorized("wrong", "expected", "production")).toBe(false);
  });

  test("allows development when token is not configured", () => {
    expect(isTokenAuthorized(undefined, undefined, "development")).toBe(true);
  });
});
```

- [ ] **Step 2: Run auth test and verify RED**

Run:

```bash
bun test apps/api/src/lib/auth.test.ts
```

Expected: FAIL because `./auth` does not exist.

- [ ] **Step 3: Extend env schema**

Modify `apps/api/src/lib/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(4101),
  CORS_ORIGIN: z.string().default("http://localhost:4100"),
  LOG_LEVEL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SLEEKFLOW_API_URL: z
    .string()
    .url()
    .default("https://api.sleekflow.io/api/message/send/json"),
  SLEEKFLOW_SEND_MEDIA_URL: z
    .string()
    .url()
    .default("https://sleekflow-core-app-seas-production.azurewebsites.net/api/message/send"),
  SLEEKFLOW_API_KEY: z.string().optional(),
  SLEEKFLOW_DEFAULT_SENDER: z.string().optional(),
  API_TOKEN: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  BUFFER_TIME_MIN: z.coerce.number().default(5),
  BUFFER_TIME_MAX: z.coerce.number().default(10),
  ORISKIN_WEBHOOK_URL: z
    .string()
    .url()
    .default("https://chatbot-api.oriskin.co.id/webhook/incoming-messages-sleekflow"),
  ORISKIN_FORWARDING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 4: Implement auth helper**

Create `apps/api/src/lib/auth.ts`:

```ts
import { AppError } from "@api/lib/errors";
import { env } from "@api/lib/env";

export function getProvidedToken(
  authorizationHeader: string | undefined,
  queryToken: string | undefined,
): string | undefined {
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length);
  }

  return queryToken;
}

export function isTokenAuthorized(
  providedToken: string | undefined,
  expectedToken: string | undefined,
  nodeEnv: string,
): boolean {
  if (!expectedToken) {
    return nodeEnv !== "production";
  }

  return providedToken === expectedToken;
}

export function assertApiToken(
  authorizationHeader: string | undefined,
  queryToken: string | undefined,
): void {
  const providedToken = getProvidedToken(authorizationHeader, queryToken);

  if (!isTokenAuthorized(providedToken, env.API_TOKEN, env.NODE_ENV)) {
    throw new AppError("UNAUTHORIZED", "Invalid authentication token", 401);
  }
}
```

- [ ] **Step 5: Update env example**

Modify `apps/api/.env.example`:

```env
# Core runtime
NODE_ENV=development
PORT=4101
CORS_ORIGIN="http://localhost:4100"
LOG_LEVEL=debug

# Database
DATABASE_URL="postgresql://sleekflow_user:REDACTED@76.13.20.7:5434/sleekflow"

# SleekFlow
SLEEKFLOW_API_URL="https://api.sleekflow.io/api/message/send/json"
SLEEKFLOW_SEND_MEDIA_URL="https://sleekflow-core-app-seas-production.azurewebsites.net/api/message/send"
SLEEKFLOW_API_KEY="REDACTED"
SLEEKFLOW_DEFAULT_SENDER=""

# Gateway auth
API_TOKEN="REDACTED"

# Redis buffering
REDIS_HOST="localhost"
REDIS_PORT=6379
BUFFER_TIME_MIN=5
BUFFER_TIME_MAX=10

# Oriskin forwarding
ORISKIN_WEBHOOK_URL="https://chatbot-api.oriskin.co.id/webhook/incoming-messages-sleekflow"
ORISKIN_FORWARDING_ENABLED=true
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
bun test apps/api/src/lib/auth.test.ts
bun run check-types --filter api
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/env.ts apps/api/src/lib/auth.ts apps/api/src/lib/auth.test.ts apps/api/.env.example
git commit -m "feat: add api auth and integration env"
```

## Task 4: Add SleekFlow Payload Normalizer

**Files:**
- Create: `apps/api/src/modules/sleekflow/types.ts`
- Create: `apps/api/src/modules/sleekflow/normalizer.ts`
- Test: `apps/api/src/modules/sleekflow/__tests__/normalizer.test.ts`

- [ ] **Step 1: Write failing normalizer tests**

Create `apps/api/src/modules/sleekflow/__tests__/normalizer.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { normalizeSleekflowWebhookPayload } from "../normalizer";

describe("normalizeSleekflowWebhookPayload", () => {
  test("normalizes WhatsApp Flow Builder message payload", () => {
    const normalized = normalizeSleekflowWebhookPayload({
      channel: "whatsappcloudapi",
      conversation_id: "conv-wa",
      message_id: "msg-wa",
      message_unique_id: "unique-wa",
      channel_id: "628156747546",
      is_sent_from_sleekflow: false,
      message: {
        message_type: "text",
        message_content: "halo",
      },
      contact: {
        PhoneNumber: "628123456789",
        first_name: "Ayu",
        last_name: "Putri",
      },
    });

    expect(normalized.channel).toBe("whatsappcloudapi");
    expect(normalized.contact.phone).toBe("628123456789");
    expect(normalized.contact.displayName).toBe("Ayu Putri");
    expect(normalized.messageContent).toBe("halo");
    expect(normalized.direction).toBe("inbound");
  });

  test("normalizes Instagram payload without requiring phone number", () => {
    const normalized = normalizeSleekflowWebhookPayload({
      channel: "instagram",
      conversation_id: "conv-ig",
      message_id: "msg-ig",
      channel_id: "ig-channel-user",
      is_sent_from_sleekflow: false,
      message: {
        message_type: "text",
        message_content: "hello from ig",
      },
      contact: {
        id: "ig-contact-1",
        name: "Instagram User",
      },
    });

    expect(normalized.channel).toBe("instagram");
    expect(normalized.contact.phone).toBeUndefined();
    expect(normalized.contact.externalContactId).toBe("ig-contact-1");
    expect(normalized.contact.channelIdentityId).toBe("ig-channel-user");
    expect(normalized.contact.displayName).toBe("Instagram User");
  });
});
```

- [ ] **Step 2: Run normalizer test and verify RED**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/normalizer.test.ts
```

Expected: FAIL because module files do not exist.

- [ ] **Step 3: Define types**

Create `apps/api/src/modules/sleekflow/types.ts`:

```ts
export type MessageDirection = "inbound" | "outbound";

export type NormalizedSleekflowContact = {
  phone?: string;
  externalContactId?: string;
  channelIdentityId?: string;
  displayName?: string;
  rawProfile?: Record<string, unknown>;
};

export type NormalizedSleekflowMessage = {
  channel: string;
  conversationId?: string;
  messageId?: string;
  messageUniqueId?: string;
  messageType: string;
  messageContent?: string;
  isSentFromSleekflow: boolean;
  direction: MessageDirection;
  channelId?: string;
  contact: NormalizedSleekflowContact;
  rawPayload: Record<string, unknown>;
};

export type SendTextMessageInput = {
  channel: string;
  to: string;
  from?: string;
  messageType: string;
  messageContent: string;
  analyticTags?: string[];
};

export type SendTemplateMessageInput = {
  channel: string;
  to: string;
  from?: string;
  messageType?: "template";
  extendedMessage: Record<string, unknown>;
  analyticTags?: string[];
};
```

- [ ] **Step 4: Implement normalizer**

Create `apps/api/src/modules/sleekflow/normalizer.ts`:

```ts
import type { NormalizedSleekflowMessage } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function displayNameFromContact(contact: Record<string, unknown>): string | undefined {
  const directName = asString(contact.Name) ?? asString(contact.name);
  if (directName) {
    return directName;
  }

  const firstName = asString(contact.first_name);
  const lastName = asString(contact.last_name);
  return [firstName, lastName].filter(Boolean).join(" ") || undefined;
}

export function normalizeSleekflowWebhookPayload(
  payload: Record<string, unknown>,
): NormalizedSleekflowMessage {
  const message = asRecord(payload.message);
  const contact = asRecord(payload.contact);
  const channel = asString(payload.channel) ?? "unknown";
  const isSentFromSleekflow = payload.is_sent_from_sleekflow === true;

  return {
    channel,
    conversationId: asString(payload.conversation_id),
    messageId: asString(payload.message_id),
    messageUniqueId: asString(payload.message_unique_id),
    messageType: asString(message.message_type) ?? "unknown",
    messageContent: asString(message.message_content),
    isSentFromSleekflow,
    direction: isSentFromSleekflow ? "outbound" : "inbound",
    channelId: asString(payload.channel_id),
    contact: {
      phone: asString(contact.PhoneNumber) ?? asString(contact.phone_number),
      externalContactId:
        asString(contact.id) ??
        asString(contact.contact_id) ??
        asString(contact.ContactId),
      channelIdentityId: asString(payload.channel_id),
      displayName: displayNameFromContact(contact),
      rawProfile: contact,
    },
    rawPayload: payload,
  };
}
```

- [ ] **Step 5: Run test and typecheck**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/normalizer.test.ts
bun run check-types --filter api
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/sleekflow
git commit -m "feat: normalize sleekflow webhook payloads"
```

## Task 5: Add SleekFlow HTTP Client

**Files:**
- Create: `apps/api/src/modules/sleekflow/client.ts`
- Test: `apps/api/src/modules/sleekflow/__tests__/client.test.ts`

- [ ] **Step 1: Write client test**

Create `apps/api/src/modules/sleekflow/__tests__/client.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildSleekflowTextPayload } from "../client";

describe("buildSleekflowTextPayload", () => {
  test("builds text payload with from and analytic tags", () => {
    expect(
      buildSleekflowTextPayload({
        channel: "whatsappcloudapi",
        to: "628123",
        from: "628999",
        messageType: "text",
        messageContent: "hello",
        analyticTags: ["api", "manual"],
      }),
    ).toEqual({
      channel: "whatsappcloudapi",
      to: "628123",
      from: "628999",
      messageType: "text",
      messageContent: "hello",
      analyticTags: ["api", "manual"],
    });
  });
});
```

- [ ] **Step 2: Run client test and verify RED**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/client.test.ts
```

Expected: FAIL because `buildSleekflowTextPayload` is not implemented.

- [ ] **Step 3: Implement client**

Create `apps/api/src/modules/sleekflow/client.ts`:

```ts
import { env } from "@api/lib/env";
import { AppError } from "@api/lib/errors";
import type { SendTemplateMessageInput, SendTextMessageInput } from "./types";

export type SleekflowClientResponse = {
  statusCode: number;
  body: unknown;
};

export function buildSleekflowTextPayload(input: SendTextMessageInput): Record<string, unknown> {
  return {
    channel: input.channel,
    to: input.to,
    ...(input.from ? { from: input.from } : {}),
    messageType: input.messageType,
    messageContent: input.messageContent,
    ...(input.analyticTags ? { analyticTags: input.analyticTags } : {}),
  };
}

export function buildSleekflowTemplatePayload(
  input: SendTemplateMessageInput,
): Record<string, unknown> {
  return {
    channel: input.channel,
    to: input.to,
    ...(input.from ? { from: input.from } : {}),
    messageType: "template",
    extendedMessage: input.extendedMessage,
    ...(input.analyticTags ? { analyticTags: input.analyticTags } : {}),
  };
}

function getHeaders(): HeadersInit {
  if (!env.SLEEKFLOW_API_KEY) {
    throw new AppError("SLEEKFLOW_NOT_CONFIGURED", "SleekFlow API key is not configured", 500);
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Sleekflow-Api-Key": env.SLEEKFLOW_API_KEY,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function sendSleekflowTextMessage(
  input: SendTextMessageInput,
): Promise<SleekflowClientResponse> {
  const response = await fetch(env.SLEEKFLOW_API_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(buildSleekflowTextPayload(input)),
  });
  const body = await readResponseBody(response);

  if (!response.ok && response.status < 500) {
    throw new AppError("SLEEKFLOW_REQUEST_FAILED", "Failed to send SleekFlow message", 502, {
      statusCode: response.status,
      response: body,
    });
  }

  return { statusCode: response.status, body };
}

export async function sendSleekflowTemplateMessage(
  input: SendTemplateMessageInput,
): Promise<SleekflowClientResponse> {
  const response = await fetch(env.SLEEKFLOW_API_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(buildSleekflowTemplatePayload(input)),
  });
  const body = await readResponseBody(response);

  if (!response.ok && response.status < 500) {
    throw new AppError("SLEEKFLOW_REQUEST_FAILED", "Failed to send SleekFlow template", 502, {
      statusCode: response.status,
      response: body,
    });
  }

  return { statusCode: response.status, body };
}

export async function sendSleekflowMediaMessage(formData: FormData): Promise<SleekflowClientResponse> {
  if (!env.SLEEKFLOW_API_KEY) {
    throw new AppError("SLEEKFLOW_NOT_CONFIGURED", "SleekFlow API key is not configured", 500);
  }

  const response = await fetch(env.SLEEKFLOW_SEND_MEDIA_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Sleekflow-Api-Key": env.SLEEKFLOW_API_KEY,
    },
    body: formData,
  });
  const body = await readResponseBody(response);

  if (!response.ok && response.status < 500) {
    throw new AppError("SLEEKFLOW_REQUEST_FAILED", "Failed to send SleekFlow media", 502, {
      statusCode: response.status,
      response: body,
    });
  }

  return { statusCode: response.status, body };
}
```

- [ ] **Step 4: Run test and typecheck**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/client.test.ts
bun run check-types --filter api
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/sleekflow/client.ts apps/api/src/modules/sleekflow/__tests__/client.test.ts
git commit -m "feat: add sleekflow api client"
```

## Task 6: Add Redis Buffering

**Files:**
- Add dependency: `ioredis`
- Create: `apps/api/src/modules/buffer/redis.ts`
- Create: `apps/api/src/modules/buffer/worker.ts`
- Test: `apps/api/src/modules/buffer/__tests__/worker.test.ts`

- [ ] **Step 1: Add dependency**

Run:

```bash
bun add ioredis --filter api
```

Expected: `apps/api/package.json` and `bun.lockb` update.

- [ ] **Step 2: Write buffer key test**

Create `apps/api/src/modules/buffer/__tests__/worker.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildBufferKey, joinBufferedMessages } from "../worker";

describe("buffer worker helpers", () => {
  test("builds channel-aware buffer key", () => {
    expect(buildBufferKey("instagram", "external:ig-user-1")).toBe(
      "sleekflow:buffer:instagram:external:ig-user-1",
    );
  });

  test("joins buffered messages with spaces", () => {
    expect(joinBufferedMessages(["halo", "mau booking"])).toBe("halo mau booking");
  });
});
```

- [ ] **Step 3: Run buffer test and verify RED**

Run:

```bash
bun test apps/api/src/modules/buffer/__tests__/worker.test.ts
```

Expected: FAIL because worker module does not exist.

- [ ] **Step 4: Implement Redis client**

Create `apps/api/src/modules/buffer/redis.ts`:

```ts
import Redis from "ioredis";
import { env } from "@api/lib/env";
import { logger } from "@api/lib/logger";

let redis: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (redis !== undefined) {
    return redis;
  }

  try {
    redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });

    redis.on("error", (error) => {
      logger.warn({ error }, "Redis buffering error");
    });

    return redis;
  } catch (error) {
    logger.warn({ error }, "Redis buffering disabled");
    redis = null;
    return null;
  }
}
```

- [ ] **Step 5: Implement buffer worker**

Create `apps/api/src/modules/buffer/worker.ts`:

```ts
import type Redis from "ioredis";
import { env } from "@api/lib/env";
import { logger } from "@api/lib/logger";
import { getRedisClient } from "./redis";

export type BufferedMessage = {
  channel: string;
  primaryIdentifier: string;
  phone?: string;
  message: string;
};

export function buildBufferKey(channel: string, primaryIdentifier: string): string {
  return `sleekflow:buffer:${channel}:${primaryIdentifier}`;
}

export function joinBufferedMessages(messages: string[]): string {
  return messages.join(" ");
}

function getRandomTtlSeconds(): number {
  const min = Math.min(env.BUFFER_TIME_MIN, env.BUFFER_TIME_MAX);
  const max = Math.max(env.BUFFER_TIME_MIN, env.BUFFER_TIME_MAX);
  return Math.floor(Math.random() * (max - min + 1)) + min + 5;
}

async function forwardToOriskin(input: BufferedMessage & { message: string }): Promise<void> {
  if (!env.ORISKIN_FORWARDING_ENABLED) {
    return;
  }

  const response = await fetch(env.ORISKIN_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.phone ? { customer_phone: input.phone } : {}),
      customer_identifier: input.primaryIdentifier,
      channel: input.channel,
      message: input.message,
    }),
  });

  if (!response.ok) {
    logger.warn({ status: response.status }, "Oriskin forwarding returned non-OK status");
  }
}

export async function bufferOrForwardMessage(input: BufferedMessage): Promise<"buffered" | "forwarded"> {
  const redis = getRedisClient();

  if (!redis) {
    await forwardToOriskin(input);
    return "forwarded";
  }

  try {
    await redis.connect().catch(() => undefined);
    const key = buildBufferKey(input.channel, input.primaryIdentifier);
    const existing = await redis.get(key);
    const messages = existing ? (JSON.parse(existing) as string[]) : [];
    messages.push(input.message);
    await redis.set(key, JSON.stringify(messages), "EX", getRandomTtlSeconds());
    return "buffered";
  } catch (error) {
    logger.warn({ error }, "Redis buffer write failed; forwarding immediately");
    await forwardToOriskin(input);
    return "forwarded";
  }
}

export async function flushDueBuffers(redis: Redis = getRedisClient() as Redis): Promise<number> {
  if (!redis) {
    return 0;
  }

  let flushed = 0;

  for await (const key of redis.scanStream({ match: "sleekflow:buffer:*", count: 100 })) {
    const keys = Array.isArray(key) ? key : [key];

    for (const rawKey of keys) {
      const bufferKey = String(rawKey);
      const ttl = await redis.ttl(bufferKey);

      if (ttl > 6) {
        continue;
      }

      const value = await redis.get(bufferKey);
      if (!value) {
        continue;
      }

      const [, , channel, ...identifierParts] = bufferKey.split(":");
      const primaryIdentifier = identifierParts.join(":");
      const messages = JSON.parse(value) as string[];
      await forwardToOriskin({
        channel,
        primaryIdentifier,
        message: joinBufferedMessages(messages),
      });
      await redis.del(bufferKey);
      flushed += 1;
    }
  }

  return flushed;
}

export function startBufferWorker(): ReturnType<typeof setInterval> | undefined {
  if (!env.ORISKIN_FORWARDING_ENABLED) {
    return undefined;
  }

  return setInterval(() => {
    flushDueBuffers().catch((error) => {
      logger.warn({ error }, "Buffer worker flush failed");
    });
  }, 5000);
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
bun test apps/api/src/modules/buffer/__tests__/worker.test.ts
bun run check-types --filter api
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json bun.lockb apps/api/src/modules/buffer
git commit -m "feat: add redis message buffering"
```

## Task 7: Add SleekFlow Service Orchestration

**Files:**
- Create: `apps/api/src/modules/sleekflow/service.ts`
- Test: `apps/api/src/modules/sleekflow/__tests__/service.test.ts`

- [ ] **Step 1: Write pure helper service test**

Create `apps/api/src/modules/sleekflow/__tests__/service.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildOutboundContactIdentityInput } from "../service";

describe("buildOutboundContactIdentityInput", () => {
  test("uses recipient as phone-like identity for WhatsApp", () => {
    expect(
      buildOutboundContactIdentityInput({
        channel: "whatsappcloudapi",
        to: "628123",
      }),
    ).toEqual({
      channel: "whatsappcloudapi",
      phone: "628123",
      externalContactId: undefined,
      channelIdentityId: undefined,
      conversationId: undefined,
    });
  });

  test("uses external id for Instagram", () => {
    expect(
      buildOutboundContactIdentityInput({
        channel: "instagram",
        to: "ig-user-1",
      }),
    ).toEqual({
      channel: "instagram",
      phone: undefined,
      externalContactId: "ig-user-1",
      channelIdentityId: "ig-user-1",
      conversationId: undefined,
    });
  });
});
```

- [ ] **Step 2: Run service test and verify RED**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/service.test.ts
```

Expected: FAIL because service module does not exist.

- [ ] **Step 3: Implement service**

Create `apps/api/src/modules/sleekflow/service.ts`:

```ts
import {
  buildContactIdentity,
  createSleekflowApiCall,
  createSleekflowMessage,
  getContactTimeline,
  listSleekflowContacts,
  listSleekflowConversations,
  upsertSleekflowContact,
  upsertSleekflowConversation,
  type ContactIdentityInput,
} from "@repo/database";
import { bufferOrForwardMessage } from "@api/modules/buffer/worker";
import { buildSleekflowTextPayload, sendSleekflowTemplateMessage, sendSleekflowTextMessage } from "./client";
import { normalizeSleekflowWebhookPayload } from "./normalizer";
import type { SendTemplateMessageInput, SendTextMessageInput } from "./types";

export function buildOutboundContactIdentityInput(input: {
  channel: string;
  to: string;
}): ContactIdentityInput {
  const isPhoneLike = /^\d+$/.test(input.to);

  return {
    channel: input.channel,
    phone: isPhoneLike ? input.to : undefined,
    externalContactId: isPhoneLike ? undefined : input.to,
    channelIdentityId: isPhoneLike ? undefined : input.to,
    conversationId: undefined,
  };
}

export async function handleInboundWebhook(payload: Record<string, unknown>) {
  const normalized = normalizeSleekflowWebhookPayload(payload);
  const contact = await upsertSleekflowContact({
    channel: normalized.channel,
    phone: normalized.contact.phone,
    externalContactId: normalized.contact.externalContactId,
    channelIdentityId: normalized.contact.channelIdentityId,
    conversationId: normalized.conversationId,
    displayName: normalized.contact.displayName,
    rawProfile: normalized.contact.rawProfile,
  });

  const conversation = normalized.conversationId
    ? await upsertSleekflowConversation({
        contactId: contact.id,
        channel: normalized.channel,
        sleekflowConversationId: normalized.conversationId,
        raw: normalized.rawPayload,
        lastMessageAt: new Date(),
      })
    : null;

  const message = await createSleekflowMessage({
    contactId: contact.id,
    conversationId: conversation?.id,
    direction: normalized.direction,
    channel: normalized.channel,
    messageType: normalized.messageType,
    messageContent: normalized.messageContent,
    sleekflowMessageId: normalized.messageId,
    sleekflowMessageUniqueId: normalized.messageUniqueId,
    rawPayload: normalized.rawPayload,
  });

  let forwardingStatus: "skipped" | "buffered" | "forwarded" = "skipped";

  if (normalized.direction === "inbound" && normalized.messageContent) {
    const identity = buildContactIdentity({
      channel: normalized.channel,
      phone: normalized.contact.phone,
      externalContactId: normalized.contact.externalContactId,
      channelIdentityId: normalized.contact.channelIdentityId,
      conversationId: normalized.conversationId,
    });

    forwardingStatus = await bufferOrForwardMessage({
      channel: normalized.channel,
      primaryIdentifier: identity.primaryIdentifier,
      phone: normalized.contact.phone,
      message: normalized.messageContent,
    });
  }

  return {
    success: true,
    messageId: message.id.toString(),
    conversationId: conversation?.sleekflowConversationId ?? normalized.conversationId,
    sleekflowMessageId: normalized.messageId,
    channel: normalized.channel,
    messageType: normalized.messageType,
    forwardingStatus,
  };
}

export async function sendOutboundText(input: SendTextMessageInput) {
  const contact = await upsertSleekflowContact(buildOutboundContactIdentityInput(input));
  const pendingMessage = await createSleekflowMessage({
    contactId: contact.id,
    direction: "outbound",
    channel: input.channel,
    messageType: input.messageType,
    messageContent: input.messageContent,
    analyticTags: input.analyticTags ?? [],
    status: "pending",
  });

  const requestPayload = buildSleekflowTextPayload(input);
  const result = await sendSleekflowTextMessage(input);

  await createSleekflowApiCall({
    messageId: pendingMessage.id,
    operation: "send_text",
    requestUrl: "SLEEKFLOW_API_URL",
    requestPayload,
    responseStatus: result.statusCode,
    responsePayload: result.body as Record<string, unknown>,
  });

  return {
    success: result.statusCode < 500,
    message: "Message sent successfully",
    result: result.body,
  };
}

export async function sendOutboundTemplate(input: SendTemplateMessageInput) {
  const contact = await upsertSleekflowContact(buildOutboundContactIdentityInput(input));
  const pendingMessage = await createSleekflowMessage({
    contactId: contact.id,
    direction: "outbound",
    channel: input.channel,
    messageType: "template",
    messageContent: "Template message",
    analyticTags: input.analyticTags ?? [],
    status: "pending",
  });
  const result = await sendSleekflowTemplateMessage(input);

  await createSleekflowApiCall({
    messageId: pendingMessage.id,
    operation: "send_template",
    requestUrl: "SLEEKFLOW_API_URL",
    requestPayload: input as unknown as Record<string, unknown>,
    responseStatus: result.statusCode,
    responsePayload: result.body as Record<string, unknown>,
  });

  return {
    success: result.statusCode < 500,
    message: "Template message sent successfully",
    result: result.body,
  };
}

export { getContactTimeline, listSleekflowContacts, listSleekflowConversations };
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/service.test.ts
bun run check-types --filter api
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/sleekflow/service.ts apps/api/src/modules/sleekflow/__tests__/service.test.ts
git commit -m "feat: add sleekflow message service"
```

## Task 8: Add SleekFlow Routes and Compatibility Aliases

**Files:**
- Create: `apps/api/src/modules/sleekflow/routes.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/sleekflow/__tests__/routes.test.ts`

- [ ] **Step 1: Write route smoke test**

Create `apps/api/src/modules/sleekflow/__tests__/routes.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { sleekflowRoutes } from "../routes";

describe("sleekflowRoutes", () => {
  test("route module is defined", () => {
    expect(sleekflowRoutes).toBeDefined();
  });
});
```

- [ ] **Step 2: Run route test and verify RED**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/routes.test.ts
```

Expected: FAIL because route module does not exist.

- [ ] **Step 3: Implement routes**

Create `apps/api/src/modules/sleekflow/routes.ts`:

```ts
import { Elysia, t } from "elysia";
import { assertApiToken } from "@api/lib/auth";
import {
  getContactTimeline,
  handleInboundWebhook,
  listSleekflowContacts,
  listSleekflowConversations,
  sendOutboundTemplate,
  sendOutboundText,
} from "./service";

const sendMessageBody = t.Object({
  channel: t.String(),
  to: t.String(),
  from: t.Optional(t.String()),
  fromNumber: t.Optional(t.String()),
  messageType: t.Optional(t.String()),
  messageContent: t.String(),
  analyticTags: t.Optional(t.Array(t.String())),
});

const sendTemplateBody = t.Object({
  channel: t.String(),
  to: t.String(),
  from: t.Optional(t.String()),
  fromNumber: t.Optional(t.String()),
  messageType: t.Optional(t.Literal("template")),
  extendedMessage: t.Record(t.String(), t.Any()),
  analyticTags: t.Optional(t.Array(t.String())),
});

function tokenFromQuery(query: Record<string, unknown>): string | undefined {
  return typeof query.token === "string" ? query.token : undefined;
}

export const sleekflowRoutes = new Elysia({ tags: ["Gateway"] })
  .post(
    "/webhook/sleekflow",
    async ({ body, headers, query }) => {
      assertApiToken(headers.authorization, tokenFromQuery(query));
      return handleInboundWebhook(body as Record<string, unknown>);
    },
    { body: t.Record(t.String(), t.Any()) },
  )
  .post(
    "/send",
    async ({ body, headers, query }) => {
      assertApiToken(headers.authorization, tokenFromQuery(query));
      return sendOutboundText({
        channel: body.channel,
        to: body.to,
        from: body.from ?? body.fromNumber,
        messageType: body.messageType ?? "text",
        messageContent: body.messageContent,
        analyticTags: body.analyticTags,
      });
    },
    { body: sendMessageBody },
  )
  .post(
    "/send-template",
    async ({ body, headers, query }) => {
      assertApiToken(headers.authorization, tokenFromQuery(query));
      return sendOutboundTemplate({
        channel: body.channel,
        to: body.to,
        from: body.from ?? body.fromNumber,
        messageType: "template",
        extendedMessage: body.extendedMessage,
        analyticTags: body.analyticTags,
      });
    },
    { body: sendTemplateBody },
  )
  .group("/api", (api) =>
    api
      .post(
        "/webhooks/messages",
        async ({ body, headers, query }) => {
          assertApiToken(headers.authorization, tokenFromQuery(query));
          return handleInboundWebhook(body as Record<string, unknown>);
        },
        { body: t.Record(t.String(), t.Any()) },
      )
      .post(
        "/messages",
        async ({ body, headers, query }) => {
          assertApiToken(headers.authorization, tokenFromQuery(query));
          return sendOutboundText({
            channel: body.channel,
            to: body.to,
            from: body.from ?? body.fromNumber,
            messageType: body.messageType ?? "text",
            messageContent: body.messageContent,
            analyticTags: body.analyticTags,
          });
        },
        { body: sendMessageBody },
      )
      .post(
        "/messages/templates",
        async ({ body, headers, query }) => {
          assertApiToken(headers.authorization, tokenFromQuery(query));
          return sendOutboundTemplate({
            channel: body.channel,
            to: body.to,
            from: body.from ?? body.fromNumber,
            messageType: "template",
            extendedMessage: body.extendedMessage,
            analyticTags: body.analyticTags,
          });
        },
        { body: sendTemplateBody },
      )
      .get("/contacts", ({ query }) => {
        const limit = typeof query.limit === "string" ? Number(query.limit) : 100;
        return listSleekflowContacts(limit);
      })
      .get("/contacts/:identifier/timeline", async ({ params, query, set }) => {
        const limit = typeof query.limit === "string" ? Number(query.limit) : 100;
        const timeline = await getContactTimeline(params.identifier, limit);

        if (!timeline) {
          set.status = 404;
          return {
            success: false,
            error: "CONTACT_NOT_FOUND",
            message: "Contact not found",
          };
        }

        return {
          success: true,
          data: timeline,
        };
      })
      .get("/conversations", ({ query }) => {
        const limit = typeof query.limit === "string" ? Number(query.limit) : 100;
        return listSleekflowConversations(limit);
      }),
  );
```

- [ ] **Step 4: Export and mount routes**

Modify `apps/api/src/routes/index.ts`:

```ts
/**
 * Route exports
 * Import all route modules and re-export them
 */
export { healthRoutes } from "./health";
export { gatewayRoutes } from "./gateway";
export { sleekflowRoutes } from "@api/modules/sleekflow/routes";
```

Modify imports and route mounting in `apps/api/src/app.ts`:

```ts
import { gatewayRoutes, healthRoutes, sleekflowRoutes } from "@api/routes";
```

Then include before the root route:

```ts
  .use(healthRoutes)
  .group("/api", (api) => api.use(gatewayRoutes))
  .use(sleekflowRoutes)
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
bun test apps/api/src/modules/sleekflow/__tests__/routes.test.ts
bun run check-types --filter api
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/sleekflow/routes.ts apps/api/src/modules/sleekflow/__tests__/routes.test.ts apps/api/src/routes/index.ts apps/api/src/app.ts
git commit -m "feat: add sleekflow message routes"
```

## Task 9: Add Media Route and Buffer Worker Startup

**Files:**
- Modify: `apps/api/src/modules/sleekflow/service.ts`
- Modify: `apps/api/src/modules/sleekflow/routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Implement media service function**

Modify `apps/api/src/modules/sleekflow/service.ts` by importing `sendSleekflowMediaMessage` and adding:

```ts
import { sendSleekflowMediaMessage } from "./client";

export async function sendOutboundMedia(input: {
  channel: string;
  to: string;
  from?: string;
  messageContent?: string;
  analyticTags?: string;
  file: File;
}) {
  const contact = await upsertSleekflowContact(
    buildOutboundContactIdentityInput({ channel: input.channel, to: input.to }),
  );
  const pendingMessage = await createSleekflowMessage({
    contactId: contact.id,
    direction: "outbound",
    channel: input.channel,
    messageType: "file",
    messageContent: input.messageContent,
    fileName: input.file.name,
    analyticTags: input.analyticTags ? input.analyticTags.split(",").map((tag) => tag.trim()) : [],
    status: "pending",
  });

  const formData = new FormData();
  formData.set("channel", input.channel);
  formData.set("to", input.to);
  formData.set("messageType", "file");
  formData.set("messageContent", input.messageContent ?? "");
  formData.set("analyticTags", input.analyticTags ?? "");
  if (input.from) {
    formData.set("from", input.from);
  }
  formData.set("files", input.file);

  const result = await sendSleekflowMediaMessage(formData);

  await createSleekflowApiCall({
    messageId: pendingMessage.id,
    operation: "send_media",
    requestUrl: "SLEEKFLOW_SEND_MEDIA_URL",
    requestPayload: {
      channel: input.channel,
      to: input.to,
      from: input.from,
      messageContent: input.messageContent,
      fileName: input.file.name,
    },
    responseStatus: result.statusCode,
    responsePayload: result.body as Record<string, unknown>,
  });

  return {
    success: result.statusCode < 500,
    message: "Media sent successfully",
    filename: input.file.name,
    result: result.body,
  };
}
```

- [ ] **Step 2: Add media routes**

Modify `apps/api/src/modules/sleekflow/routes.ts` imports:

```ts
import {
  getContactTimeline,
  handleInboundWebhook,
  listSleekflowContacts,
  listSleekflowConversations,
  sendOutboundMedia,
  sendOutboundTemplate,
  sendOutboundText,
} from "./service";
```

Add legacy route before `/send-template`:

```ts
  .post("/send-media", async ({ body, headers, query }) => {
    assertApiToken(headers.authorization, tokenFromQuery(query));
    const form = body as Record<string, unknown>;
    return sendOutboundMedia({
      channel: String(form.channel),
      to: String(form.to),
      from: typeof form.from === "string" ? form.from : undefined,
      messageContent: typeof form.messageContent === "string" ? form.messageContent : "",
      analyticTags: typeof form.analyticTags === "string" ? form.analyticTags : "",
      file: form.files as File,
    });
  })
```

Add new route in `/api` group:

```ts
      .post("/messages/media", async ({ body, headers, query }) => {
        assertApiToken(headers.authorization, tokenFromQuery(query));
        const form = body as Record<string, unknown>;
        return sendOutboundMedia({
          channel: String(form.channel),
          to: String(form.to),
          from: typeof form.from === "string" ? form.from : undefined,
          messageContent: typeof form.messageContent === "string" ? form.messageContent : "",
          analyticTags: typeof form.analyticTags === "string" ? form.analyticTags : "",
          file: form.files as File,
        });
      })
```

- [ ] **Step 3: Start buffer worker**

Modify `apps/api/src/app.ts` imports:

```ts
import { startBufferWorker } from "@api/modules/buffer/worker";
```

Add after `new Elysia()`:

```ts
export const app = new Elysia()
  .onStart(() => {
    startBufferWorker();
  })
```

Keep the existing middleware chain after `.onStart`.

- [ ] **Step 4: Run typecheck**

Run:

```bash
bun run check-types --filter api
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/sleekflow/service.ts apps/api/src/modules/sleekflow/routes.ts apps/api/src/app.ts
git commit -m "feat: add media sending and buffer worker startup"
```

## Task 10: Add Docker and Documentation Updates

**Files:**
- Modify: `docker-compose.yml`
- Modify: `README.md`

- [ ] **Step 1: Update docker-compose env**

Modify `docker-compose.yml` API service environment:

```yaml
    environment:
      NODE_ENV: production
      PORT: 4101
      CORS_ORIGIN: http://localhost:4100
      DATABASE_URL: ${DATABASE_URL}
      SLEEKFLOW_API_URL: ${SLEEKFLOW_API_URL}
      SLEEKFLOW_SEND_MEDIA_URL: ${SLEEKFLOW_SEND_MEDIA_URL}
      SLEEKFLOW_API_KEY: ${SLEEKFLOW_API_KEY}
      SLEEKFLOW_DEFAULT_SENDER: ${SLEEKFLOW_DEFAULT_SENDER}
      API_TOKEN: ${API_TOKEN}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      BUFFER_TIME_MIN: ${BUFFER_TIME_MIN:-5}
      BUFFER_TIME_MAX: ${BUFFER_TIME_MAX:-10}
      ORISKIN_WEBHOOK_URL: ${ORISKIN_WEBHOOK_URL}
      ORISKIN_FORWARDING_ENABLED: ${ORISKIN_FORWARDING_ENABLED:-true}
```

Add Redis service:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Add API dependency:

```yaml
    depends_on:
      redis:
        condition: service_healthy
```

- [ ] **Step 2: Update README**

Add a section to `README.md`:

```md
## SleekFlow Integration

Inbound:

- `POST /api/webhooks/messages`
- legacy alias: `POST /webhook/sleekflow`

Outbound:

- `POST /api/messages`
- `POST /api/messages/media`
- `POST /api/messages/templates`
- legacy aliases: `/send`, `/send-media`, `/send-template`

The gateway stores contacts, conversations, inbound messages, outbound messages, and SleekFlow API call logs in PostgreSQL through Prisma.

Redis buffering is used before forwarding inbound text messages to Oriskin. Buffer keys include channel and contact identity so WhatsApp and Instagram messages do not mix.

Required production secrets:

- `DATABASE_URL`
- `SLEEKFLOW_API_KEY`
- `API_TOKEN`
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml README.md
git commit -m "docs: document sleekflow integration runtime"
```

## Task 11: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Generate Prisma client**

Run:

```bash
cd packages/database && bun run db:generate
```

Expected: exits 0.

- [ ] **Step 2: Run tests**

Run:

```bash
bun test apps/api/src/lib/auth.test.ts
bun test apps/api/src/modules/sleekflow/__tests__/normalizer.test.ts
bun test apps/api/src/modules/sleekflow/__tests__/client.test.ts
bun test apps/api/src/modules/sleekflow/__tests__/service.test.ts
bun test apps/api/src/modules/sleekflow/__tests__/routes.test.ts
bun test apps/api/src/modules/buffer/__tests__/worker.test.ts
bun test packages/database/src/repositories/sleekflow.test.ts
```

Expected: all pass.

- [ ] **Step 3: Run project checks**

Run:

```bash
bun run check-types
bun run lint
bun run build
```

Expected: all pass.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: worktree clean after all task commits; recent commits show the SleekFlow integration tasks.

## Self-Review

- Spec coverage:
  - Prisma in `packages/database`: Tasks 1-2.
  - New `/api/*` routes and legacy aliases: Task 8-9.
  - WhatsApp and Instagram normalization: Task 4.
  - Outbound text/media/template: Tasks 5, 7, 8, 9.
  - Redis buffering with fallback: Task 6 and service use in Task 7.
  - Env/docs/runtime: Tasks 3 and 10.
  - Tests and verification: every implementation task plus Task 11.
- Red-flag scan: no incomplete requirement markers or unspecified "add handling" steps.
- Type consistency:
  - Normalized message types flow from `types.ts` into normalizer and service.
  - Repository helper names exported from `@repo/database` match imports in service.
  - Route function names match service exports.
