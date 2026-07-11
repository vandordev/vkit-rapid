# SSO tRPC Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected Mantine dashboard at `/` with Oriskin SSO auth, tRPC + TanStack Query data access, and list/detail pages for the SleekFlow Gateway database tables.

**Architecture:** Next.js owns the internal dashboard surface and reads Prisma through protected tRPC procedures. Elysia remains the integration API for webhooks, outbound messaging, health, OpenAPI, and service-to-service callers. `packages/database` remains the single Prisma client and generated type source.

**Tech Stack:** Bun, Turborepo, Next.js 16 App Router, React 19, Mantine 8, tRPC, TanStack Query, Prisma Client generated types, Elysia, TypeScript.

---

## File Structure

- Modify `apps/web/package.json`: add tRPC, TanStack Query, and Zod dependencies.
- Create `apps/web/constants/auth.ts`: cookie names and SSO client id.
- Create `apps/web/lib/sso.ts`: auth URL/base URL helpers.
- Create `apps/web/lib/sso.test.ts`: tests for SSO URL construction.
- Create `apps/web/lib/auth-api.ts`: SSO token/refresh HTTP helpers.
- Create `apps/web/lib/auth.ts`: server auth token lookup and refresh.
- Create `apps/web/app/callback/route.ts`: redirect public SSO callback to API callback.
- Create `apps/web/app/api/auth/callback/route.ts`: exchange SSO code and set cookies.
- Create `apps/web/app/api/auth/logout/route.ts`: clear dashboard cookies.
- Create `apps/web/server/trpc/context.ts`: create tRPC context from request cookies.
- Create `apps/web/server/trpc/trpc.ts`: tRPC init, public procedure, protected procedure.
- Create `apps/web/server/trpc/routers/dashboard.ts`: `dashboard.summary`.
- Create `apps/web/server/trpc/routers/contacts.ts`: `contacts.list` and `contacts.detail`.
- Create `apps/web/server/trpc/routers/conversations.ts`: `conversations.list` and `conversations.detail`.
- Create `apps/web/server/trpc/routers/messages.ts`: `messages.list` and `messages.detail`.
- Create `apps/web/server/trpc/routers/api-calls.ts`: `apiCalls.list` and `apiCalls.detail`.
- Create `apps/web/server/trpc/routers/modules.ts`: `modules.list`.
- Create `apps/web/server/trpc/root.ts`: compose `appRouter` and export `AppRouter`.
- Create `apps/web/app/api/trpc/[trpc]/route.ts`: Next.js tRPC HTTP handler.
- Create `apps/web/components/trpc-provider.tsx`: TanStack Query + tRPC client provider.
- Modify `apps/web/app/layout.tsx`: add provider, Mantine theme, metadata.
- Modify `apps/web/app/globals.css`: adapt Oriskin visual tokens without shadcn/Tailwind.
- Copy `../evoucher/oriskin-evoucher-web/public/images/app-logo.png` to `apps/web/public/images/app-logo.png`.
- Replace `apps/web/components/app-shell.tsx`: route-based Mantine sidebar shell with auth actions.
- Create `apps/web/components/resource-table.tsx`: small reusable Mantine table wrapper.
- Create `apps/web/components/json-view.tsx`: safe JSON payload renderer.
- Modify `apps/web/app/page.tsx`: protected overview page.
- Create `apps/web/app/contacts/page.tsx` and `apps/web/app/contacts/[id]/page.tsx`.
- Create `apps/web/app/conversations/page.tsx` and `apps/web/app/conversations/[id]/page.tsx`.
- Create `apps/web/app/messages/page.tsx` and `apps/web/app/messages/[id]/page.tsx`.
- Create `apps/web/app/api-calls/page.tsx` and `apps/web/app/api-calls/[id]/page.tsx`.
- Create `apps/web/app/gateway/page.tsx`.
- Create `apps/web/app/settings/page.tsx`.

## Task 1: Add Dashboard Data Dependencies

**Files:**
- Modify: `apps/web/package.json`
- Modify: `bun.lockb`

- [ ] **Step 1: Add dependencies**

Run:

```bash
rtk bun add --cwd apps/web @trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query zod superjson
```

Expected: `apps/web/package.json` contains these dependencies and `bun.lockb` changes.

- [ ] **Step 2: Verify install state**

Run:

```bash
rtk bun install
```

Expected: install completes without dependency resolution errors.

- [ ] **Step 3: Commit**

Run:

```bash
rtk git add apps/web/package.json bun.lockb
rtk git commit -m "chore(web): add trpc dashboard dependencies"
```

## Task 2: Add SSO URL Helpers With Tests

**Files:**
- Create: `apps/web/constants/auth.ts`
- Create: `apps/web/lib/sso.ts`
- Create: `apps/web/lib/sso.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/sso.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { buildAuthLoginUrl, getRequestBaseUrl } from "./sso";

describe("SSO helpers", () => {
  test("builds Oriskin login URL with sleekflow client id", () => {
    const url = new URL(buildAuthLoginUrl("https://gateway.example.test"));

    expect(url.origin).toBe("https://auth.oriskin.co.id");
    expect(url.searchParams.get("client_id")).toBe("sleekflow");
    expect(url.searchParams.get("redirect_url")).toBe("https://gateway.example.test/callback");
  });

  test("uses forwarded host and proto for request base URL", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "sleekflow.oriskin.test",
      host: "localhost:4100",
    });

    expect(getRequestBaseUrl(headers)).toBe("https://sleekflow.oriskin.test");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk bun test apps/web/lib/sso.test.ts
```

Expected: FAIL because `apps/web/lib/sso.ts` does not exist.

- [ ] **Step 3: Implement constants and helper**

Create `apps/web/constants/auth.ts`:

```ts
export const AUTH_TOKEN_COOKIE_NAME = "sleekflow_gateway_token";
export const AUTH_SESSION_COOKIE_NAME = "sleekflow_gateway_session";
export const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID ?? "sleekflow";
```

Create `apps/web/lib/sso.ts`:

```ts
import { SSO_CLIENT_ID } from "@/constants/auth";

const DEFAULT_AUTH_URL = "https://auth.oriskin.co.id";
const DEFAULT_APP_BASE_URL = "http://localhost:4100";

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function firstForwardedValue(value: string | null) {
  if (!value) return "";
  return value.split(",")[0]?.trim() || "";
}

export function getAuthUrl() {
  return sanitizeBaseUrl(process.env.NEXT_PUBLIC_AUTH_URL || process.env.AUTH_URL || DEFAULT_AUTH_URL);
}

export function getRequestBaseUrl(requestHeaders: Headers) {
  const forwardedProto = firstForwardedValue(requestHeaders.get("x-forwarded-proto"));
  const forwardedHost = firstForwardedValue(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost || requestHeaders.get("host") || "";

  if (host) {
    return `${forwardedProto || "http"}://${host}`;
  }

  return sanitizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE_URL);
}

export function buildAuthLoginUrl(currentBaseUrl: string) {
  const url = new URL(getAuthUrl());
  url.searchParams.set("client_id", SSO_CLIENT_ID);
  url.searchParams.set("redirect_url", `${sanitizeBaseUrl(currentBaseUrl)}/callback`);
  return url.toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
rtk bun test apps/web/lib/sso.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/web/constants/auth.ts apps/web/lib/sso.ts apps/web/lib/sso.test.ts
rtk git commit -m "feat(web): add sleekflow sso helpers"
```

## Task 3: Add Auth Token API And Server Auth

**Files:**
- Create: `apps/web/lib/auth-api.ts`
- Create: `apps/web/lib/auth.ts`

- [ ] **Step 1: Write token API helper**

Create `apps/web/lib/auth-api.ts`:

```ts
export type TokenData = {
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: number;
  refresh_token_expires_at?: number;
};

type ApiResponse<T> = {
  data?: T | { data?: T };
};

const DEFAULT_AUTH_URL = "https://auth.oriskin.co.id";

function sanitizeBaseUrl(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/\/$/, "");
}

function parseMap(raw: string | undefined) {
  const map = new Map<string, string>();
  if (!raw) return map;

  for (const entry of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key && value) map.set(key, value);
  }

  return map;
}

export function resolveAuthBaseUrl() {
  const mapped = process.env.BACKEND_URL_MAP ? parseMap(process.env.BACKEND_URL_MAP).get("auth") : undefined;
  return sanitizeBaseUrl(mapped, process.env.AUTH_URL || process.env.NEXT_PUBLIC_AUTH_URL || DEFAULT_AUTH_URL);
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

export function extractTokenData(payload: ApiResponse<TokenData> | null | undefined): TokenData | null {
  if (!payload?.data) return null;

  const directData = payload.data as TokenData;
  if (directData.access_token || directData.refresh_token) return directData;

  const nestedData = (payload.data as { data?: TokenData }).data;
  if (nestedData?.access_token || nestedData?.refresh_token) return nestedData;

  return null;
}

export async function exchangeAuthCode(options: { baseUrl?: string; code: string }) {
  const baseUrl = sanitizeBaseUrl(options.baseUrl, `${resolveAuthBaseUrl()}/api/sso`);
  return requestJson<TokenData>(`${baseUrl}/token`, {
    method: "POST",
    body: JSON.stringify({ code: options.code }),
  });
}

export async function refreshAuthToken(refreshToken: string) {
  const query = new URLSearchParams({ refresh_token: refreshToken }).toString();
  return requestJson<TokenData>(`${resolveAuthBaseUrl()}/api/sso/refresh?${query}`);
}
```

- [ ] **Step 2: Write server auth helper**

Create `apps/web/lib/auth.ts`:

```ts
import { cookies } from "next/headers";

import { AUTH_SESSION_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME } from "@/constants/auth";
import { extractTokenData, refreshAuthToken } from "@/lib/auth-api";

export async function authServer() {
  const token = await getValidAccessToken();
  return token ?? null;
}

export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  if (accessToken) {
    return accessToken;
  }

  const refreshToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshAuthToken(refreshToken);
    return extractTokenData(refreshed)?.access_token ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Run typecheck for auth files**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS or only pre-existing unrelated errors. Fix import/path errors from this task before proceeding.

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add apps/web/lib/auth-api.ts apps/web/lib/auth.ts
rtk git commit -m "feat(web): add server sso auth helpers"
```

## Task 4: Add Callback And Logout Routes

**Files:**
- Create: `apps/web/app/callback/route.ts`
- Create: `apps/web/app/api/auth/callback/route.ts`
- Create: `apps/web/app/api/auth/logout/route.ts`

- [ ] **Step 1: Add public callback redirect**

Create `apps/web/app/callback/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";

import { getRequestBaseUrl } from "@/lib/sso";

export async function GET(req: NextRequest) {
  const callbackUrl = new URL("/api/auth/callback", getRequestBaseUrl(req.headers));
  callbackUrl.search = req.nextUrl.search;

  return NextResponse.redirect(callbackUrl);
}
```

- [ ] **Step 2: Add API callback route**

Create `apps/web/app/api/auth/callback/route.ts`:

```ts
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME } from "@/constants/auth";
import { exchangeAuthCode, extractTokenData } from "@/lib/auth-api";
import { buildAuthLoginUrl, getRequestBaseUrl } from "@/lib/sso";

function redirectToAuth(req: NextRequest) {
  return NextResponse.redirect(buildAuthLoginUrl(getRequestBaseUrl(req.headers)));
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return redirectToAuth(req);
  }

  const requestBaseUrl = getRequestBaseUrl(req.headers);
  const preferredBaseUrl = `${requestBaseUrl}/api/backends/auth/api/sso`;
  const tokenResponse = await exchangeAuthCode({ baseUrl: preferredBaseUrl, code }).catch((error) => {
    console.error(`[auth-callback] Token exchange failed via ${preferredBaseUrl}/token`, error);
    return null;
  });

  const tokenData = extractTokenData(tokenResponse);
  if (!tokenData?.access_token || !tokenData?.refresh_token) {
    console.error("[auth-callback] Missing access/refresh token in token response", tokenResponse?.data ?? tokenResponse);
    return redirectToAuth(req);
  }

  const cookieStore = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const accessMaxAge = tokenData.access_token_expires_at ? Math.max(1, tokenData.access_token_expires_at - now) : 60 * 60;
  const refreshMaxAge = tokenData.refresh_token_expires_at
    ? Math.max(1, tokenData.refresh_token_expires_at - now)
    : 60 * 60 * 24 * 30;
  const forwardedProto = req.headers.get("x-forwarded-proto") || "";
  const isSecure = req.nextUrl.protocol === "https:" || forwardedProto.includes("https");

  cookieStore.set(AUTH_TOKEN_COOKIE_NAME, tokenData.access_token, {
    secure: isSecure,
    sameSite: "lax",
    maxAge: accessMaxAge,
    path: "/",
  });

  cookieStore.set(AUTH_SESSION_COOKIE_NAME, tokenData.refresh_token, {
    secure: isSecure,
    sameSite: "lax",
    maxAge: refreshMaxAge,
    path: "/",
  });

  return NextResponse.redirect(`${requestBaseUrl}/`);
}
```

- [ ] **Step 3: Add logout route**

Create `apps/web/app/api/auth/logout/route.ts`:

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME } from "@/constants/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_TOKEN_COOKIE_NAME);
  cookieStore.delete(AUTH_SESSION_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Verify routes typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS or only pre-existing unrelated errors. Fix route/import errors from this task before proceeding.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/web/app/callback/route.ts apps/web/app/api/auth/callback/route.ts apps/web/app/api/auth/logout/route.ts
rtk git commit -m "feat(web): add sso callback routes"
```

## Task 5: Add tRPC Server Foundation

**Files:**
- Create: `apps/web/server/trpc/context.ts`
- Create: `apps/web/server/trpc/trpc.ts`
- Create: `apps/web/server/trpc/root.ts`
- Create: `apps/web/app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Create tRPC context**

Create `apps/web/server/trpc/context.ts`:

```ts
import { cookies } from "next/headers";

import { authServer } from "@/lib/auth";

export async function createTRPCContext() {
  const cookieStore = await cookies();
  const token = await authServer();

  return {
    token,
    cookieStore,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
```

- [ ] **Step 2: Create tRPC init and protected procedure**

Create `apps/web/server/trpc/trpc.ts`:

```ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.token) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      token: ctx.token,
    },
  });
});
```

- [ ] **Step 3: Create temporary root router**

Create `apps/web/server/trpc/root.ts`:

```ts
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Create HTTP handler**

Create `apps/web/app/api/trpc/[trpc]/route.ts`:

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/root";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 5: Verify tRPC foundation**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS or only pre-existing unrelated errors. Fix tRPC type/import errors from this task before proceeding.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add apps/web/server/trpc apps/web/app/api/trpc
rtk git commit -m "feat(web): add protected trpc foundation"
```

## Task 6: Add Typed tRPC Routers

**Files:**
- Create: `apps/web/server/trpc/routers/dashboard.ts`
- Create: `apps/web/server/trpc/routers/contacts.ts`
- Create: `apps/web/server/trpc/routers/conversations.ts`
- Create: `apps/web/server/trpc/routers/messages.ts`
- Create: `apps/web/server/trpc/routers/api-calls.ts`
- Create: `apps/web/server/trpc/routers/modules.ts`
- Modify: `apps/web/server/trpc/root.ts`

- [ ] **Step 1: Create contacts router**

Create `apps/web/server/trpc/routers/contacts.ts`:

```ts
import { Prisma, prisma } from "@repo/database";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const contactListInclude = {
  _count: {
    select: {
      messages: true,
      conversations: true,
    },
  },
} satisfies Prisma.ContactInclude;

const contactDetailInclude = {
  conversations: {
    orderBy: { lastMessageAt: "desc" },
    take: 25,
    include: {
      _count: {
        select: { messages: true },
      },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      conversation: true,
    },
  },
  _count: {
    select: {
      messages: true,
      conversations: true,
    },
  },
} satisfies Prisma.ContactInclude;

export type ContactListItem = Prisma.ContactGetPayload<{ include: typeof contactListInclude }>;
export type ContactDetail = Prisma.ContactGetPayload<{ include: typeof contactDetailInclude }>;

export const contactsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().uuid().optional(),
      search: z.string().trim().min(1).optional(),
      channel: z.string().trim().min(1).optional(),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 25;
      const where: Prisma.ContactWhereInput = {
        channel: input?.channel,
        OR: input?.search
          ? [
              { primaryIdentifier: { contains: input.search, mode: "insensitive" } },
              { phone: { contains: input.search, mode: "insensitive" } },
              { displayName: { contains: input.search, mode: "insensitive" } },
              { externalContactId: { contains: input.search, mode: "insensitive" } },
            ]
          : undefined,
      };

      const rows = await prisma.contact.findMany({
        where,
        include: contactListInclude,
        orderBy: { lastSeenAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      const nextCursor = rows.length > limit ? rows[limit]?.id : null;
      return { items: rows.slice(0, limit), nextCursor };
    }),
  detail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return prisma.contact.findUnique({
        where: { id: input.id },
        include: contactDetailInclude,
      });
    }),
});
```

- [ ] **Step 2: Create conversations router**

Create `apps/web/server/trpc/routers/conversations.ts`:

```ts
import { Prisma, prisma } from "@repo/database";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const conversationListInclude = {
  contact: true,
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationInclude;

const conversationDetailInclude = {
  contact: true,
  messages: {
    orderBy: { createdAt: "desc" },
    take: 100,
  },
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationInclude;

export const conversationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().uuid().optional(),
      search: z.string().trim().min(1).optional(),
      channel: z.string().trim().min(1).optional(),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 25;
      const where: Prisma.ConversationWhereInput = {
        channel: input?.channel,
        OR: input?.search
          ? [
              { externalConversationId: { contains: input.search, mode: "insensitive" } },
              { contact: { primaryIdentifier: { contains: input.search, mode: "insensitive" } } },
              { contact: { phone: { contains: input.search, mode: "insensitive" } } },
              { contact: { displayName: { contains: input.search, mode: "insensitive" } } },
            ]
          : undefined,
      };

      const rows = await prisma.conversation.findMany({
        where,
        include: conversationListInclude,
        orderBy: { lastMessageAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      const nextCursor = rows.length > limit ? rows[limit]?.id : null;
      return { items: rows.slice(0, limit), nextCursor };
    }),
  detail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) =>
      prisma.conversation.findUnique({
        where: { id: input.id },
        include: conversationDetailInclude,
      }),
    ),
});
```

- [ ] **Step 3: Create messages router**

Create `apps/web/server/trpc/routers/messages.ts`:

```ts
import { MessageDirection, Prisma, prisma } from "@repo/database";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const messageListInclude = {
  contact: true,
  conversation: true,
} satisfies Prisma.MessageInclude;

const messageDetailInclude = {
  contact: true,
  conversation: true,
  apiCalls: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.MessageInclude;

export const messagesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().uuid().optional(),
      search: z.string().trim().min(1).optional(),
      channel: z.string().trim().min(1).optional(),
      direction: z.nativeEnum(MessageDirection).optional(),
      status: z.string().trim().min(1).optional(),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 25;
      const where: Prisma.MessageWhereInput = {
        channel: input?.channel,
        direction: input?.direction,
        status: input?.status,
        OR: input?.search
          ? [
              { messageContent: { contains: input.search, mode: "insensitive" } },
              { messageType: { contains: input.search, mode: "insensitive" } },
              { externalMessageId: { contains: input.search, mode: "insensitive" } },
              { contact: { primaryIdentifier: { contains: input.search, mode: "insensitive" } } },
            ]
          : undefined,
      };

      const rows = await prisma.message.findMany({
        where,
        include: messageListInclude,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      const nextCursor = rows.length > limit ? rows[limit]?.id : null;
      return { items: rows.slice(0, limit), nextCursor };
    }),
  detail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) =>
      prisma.message.findUnique({
        where: { id: input.id },
        include: messageDetailInclude,
      }),
    ),
});
```

- [ ] **Step 4: Create API calls router**

Create `apps/web/server/trpc/routers/api-calls.ts`:

```ts
import { Prisma, prisma } from "@repo/database";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const apiCallListInclude = {
  message: {
    include: {
      contact: true,
    },
  },
} satisfies Prisma.ApiCallInclude;

export const apiCallsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().uuid().optional(),
      search: z.string().trim().min(1).optional(),
      operation: z.string().trim().min(1).optional(),
      responseStatus: z.number().int().optional(),
      failedOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 25;
      const where: Prisma.ApiCallWhereInput = {
        operation: input?.operation,
        responseStatus: input?.responseStatus,
        error: input?.failedOnly ? { not: null } : undefined,
        OR: input?.search
          ? [
              { operation: { contains: input.search, mode: "insensitive" } },
              { requestUrl: { contains: input.search, mode: "insensitive" } },
              { error: { contains: input.search, mode: "insensitive" } },
            ]
          : undefined,
      };

      const rows = await prisma.apiCall.findMany({
        where,
        include: apiCallListInclude,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      const nextCursor = rows.length > limit ? rows[limit]?.id : null;
      return { items: rows.slice(0, limit), nextCursor };
    }),
  detail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) =>
      prisma.apiCall.findUnique({
        where: { id: input.id },
        include: apiCallListInclude,
      }),
    ),
});
```

- [ ] **Step 5: Create dashboard and modules routers**

Create `apps/web/server/trpc/routers/dashboard.ts`:

```ts
import { prisma } from "@repo/database";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const dashboardRouter = createTRPCRouter({
  summary: protectedProcedure.query(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      totalContacts,
      totalConversations,
      totalMessages,
      inboundMessages,
      outboundMessages,
      recentApiCalls,
      recentApiErrors,
      latestMessages,
      latestApiErrors,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.message.count({ where: { direction: "inbound" } }),
      prisma.message.count({ where: { direction: "outbound" } }),
      prisma.apiCall.count({ where: { createdAt: { gte: since } } }),
      prisma.apiCall.count({ where: { createdAt: { gte: since }, OR: [{ error: { not: null } }, { responseStatus: { gte: 400 } }] } }),
      prisma.message.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { contact: true } }),
      prisma.apiCall.findMany({ where: { OR: [{ error: { not: null } }, { responseStatus: { gte: 400 } }] }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

    const messagesByChannel = await prisma.message.groupBy({
      by: ["channel"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { channel: "desc" } },
    });

    return {
      totalContacts,
      totalConversations,
      totalMessages,
      inboundMessages,
      outboundMessages,
      recentApiCalls,
      recentApiErrors,
      messagesByChannel,
      latestMessages,
      latestApiErrors,
    };
  }),
});
```

Create `apps/web/server/trpc/routers/modules.ts`:

```ts
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const modulesRouter = createTRPCRouter({
  list: protectedProcedure.query(() => [
    { id: "webhooks", name: "Inbound Webhooks", routes: ["POST /api/webhooks/messages", "POST /webhook/sleekflow"] },
    { id: "send-text", name: "Outbound Text", routes: ["POST /api/messages", "POST /send"] },
    { id: "send-media", name: "Outbound Media", routes: ["POST /api/messages/media", "POST /send-media"] },
    { id: "send-template", name: "Outbound Templates", routes: ["POST /api/messages/templates", "POST /send-template"] },
    { id: "contacts", name: "Contacts", routes: ["GET /api/contacts", "GET /api/contacts/:identifier/timeline"] },
    { id: "conversations", name: "Conversations", routes: ["GET /api/conversations"] },
    { id: "buffer", name: "Redis Buffer Worker", routes: ["worker: sleekflow buffer flush"] },
    { id: "health", name: "Health And OpenAPI", routes: ["GET /health", "GET /openapi"] },
  ]),
});
```

- [ ] **Step 6: Compose root router**

Replace `apps/web/server/trpc/root.ts`:

```ts
import { apiCallsRouter } from "./routers/api-calls";
import { contactsRouter } from "./routers/contacts";
import { conversationsRouter } from "./routers/conversations";
import { dashboardRouter } from "./routers/dashboard";
import { messagesRouter } from "./routers/messages";
import { modulesRouter } from "./routers/modules";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  contacts: contactsRouter,
  conversations: conversationsRouter,
  messages: messagesRouter,
  apiCalls: apiCallsRouter,
  modules: modulesRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 7: Verify router types**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS. Fix Prisma generated type errors before proceeding; do not replace typed payloads with `any`.

- [ ] **Step 8: Commit**

Run:

```bash
rtk git add apps/web/server/trpc
rtk git commit -m "feat(web): add typed dashboard trpc routers"
```

## Task 7: Add tRPC React Provider And Mantine Theme

**Files:**
- Create: `apps/web/components/trpc-provider.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`
- Copy: `apps/web/public/images/app-logo.png`

- [ ] **Step 1: Copy app image**

Run:

```bash
rtk mkdir -p apps/web/public/images
rtk cp ../evoucher/oriskin-evoucher-web/public/images/app-logo.png apps/web/public/images/app-logo.png
```

Expected: `apps/web/public/images/app-logo.png` exists.

- [ ] **Step 2: Create tRPC provider**

Create `apps/web/components/trpc-provider.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@/server/trpc/root";

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4100";
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 3: Update root layout**

Update `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Space_Grotesk } from "next/font/google";

import { TRPCProvider } from "@/components/trpc-provider";

import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const theme = createTheme({
  primaryColor: "oriskin",
  defaultRadius: "md",
  fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
  },
  colors: {
    oriskin: [
      "#fff1f0",
      "#ffe1df",
      "#ffc4bf",
      "#ff9d96",
      "#f87168",
      "#e84f45",
      "#d93a30",
      "#b82d25",
      "#982821",
      "#7e251f",
    ],
  },
});

export const metadata: Metadata = {
  title: "SleekFlow Gateway",
  description: "Protected Oriskin SleekFlow Gateway dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light" theme={theme}>
          <TRPCProvider>
            <Notifications position="top-right" />
            {children}
          </TRPCProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Update global CSS**

Replace `apps/web/app/globals.css`:

```css
:root {
  color-scheme: light;
  --app-bg: #fbfaf9;
  --app-text: #211817;
  --app-muted: #6f6563;
  --app-border: #eee4e2;
  --app-sidebar: #fffdfc;
}

html,
body {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--app-bg);
  color: var(--app-text);
}

* {
  box-sizing: border-box;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 5: Verify theme/provider typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add apps/web/components/trpc-provider.tsx apps/web/app/layout.tsx apps/web/app/globals.css apps/web/public/images/app-logo.png
rtk git commit -m "feat(web): add trpc provider and oriskin theme"
```

## Task 8: Build Protected Dashboard Shell

**Files:**
- Replace: `apps/web/components/app-shell.tsx`

- [ ] **Step 1: Replace shell component**

Replace `apps/web/components/app-shell.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  Badge,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  Activity,
  ContactRound,
  Database,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Network,
  PhoneCall,
  Settings,
  Webhook,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/messages", label: "Messages", icon: PhoneCall },
  { href: "/api-calls", label: "API Calls", icon: Activity },
  { href: "/gateway", label: "Gateway", icon: Webhook },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type GatewayShellProps = {
  children: React.ReactNode;
};

export function GatewayShell({ children }: GatewayShellProps) {
  const [opened, setOpened] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 292,
        breakpoint: "sm",
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={() => setOpened((value) => !value)} hiddenFrom="sm" size="sm" />
            <Image src="/images/app-logo.png" alt="SleekFlow Gateway" width={32} height={32} />
            <div>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Oriskin
              </Text>
              <Title order={4}>SleekFlow Gateway</Title>
            </div>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color="oriskin">
              Protected
            </Badge>
            <Button variant="default" size="xs" leftSection={<LogOut size={14} />} onClick={logout}>
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" bg="var(--app-sidebar)">
        <Stack h="100%" justify="space-between" gap="md">
          <Stack gap="xs">
            <Group gap="sm" px="xs" py="sm">
              <Database size={18} />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Dashboard
              </Text>
            </Group>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  active={active}
                  leftSection={<Icon size={16} />}
                  onClick={() => setOpened(false)}
                />
              );
            })}
          </Stack>

          <Stack gap="sm">
            <Divider />
            <Text size="xs" c="dimmed">
              Internal dashboard data is served by protected tRPC procedures. Elysia remains the service API.
            </Text>
            <Group gap={6}>
              <Network size={14} />
              <Text size="xs" fw={600}>
                client_id=sleekflow
              </Text>
            </Group>
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <ScrollArea type="never">
          <Stack gap="lg" maw={1280} mx="auto">
            {children}
          </Stack>
        </ScrollArea>
      </AppShell.Main>
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify shell typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
rtk git add apps/web/components/app-shell.tsx
rtk git commit -m "feat(web): add protected dashboard shell"
```

## Task 9: Add Shared Dashboard UI Helpers

**Files:**
- Create: `apps/web/components/json-view.tsx`
- Create: `apps/web/components/resource-table.tsx`

- [ ] **Step 1: Create JSON view**

Create `apps/web/components/json-view.tsx`:

```tsx
import { Code, Text } from "@mantine/core";

export function JsonView({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <Text c="dimmed">No payload</Text>;
  }

  return (
    <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {JSON.stringify(value, null, 2)}
    </Code>
  );
}
```

- [ ] **Step 2: Create resource table wrapper**

Create `apps/web/components/resource-table.tsx`:

```tsx
import { Paper, Table, Text } from "@mantine/core";

export type ResourceColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
};

export function ResourceTable<T extends { id: string }>({
  columns,
  rows,
  emptyLabel,
}: {
  columns: ResourceColumn<T>[];
  rows: T[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <Paper withBorder p="lg">
        <Text c="dimmed">{emptyLabel}</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder style={{ overflow: "hidden" }}>
      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.key}>{column.label}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              {columns.map((column) => (
                <Table.Td key={column.key}>{column.render(row)}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
```

- [ ] **Step 3: Verify helper typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add apps/web/components/json-view.tsx apps/web/components/resource-table.tsx
rtk git commit -m "feat(web): add dashboard ui helpers"
```

## Task 10: Add Protected Overview Page

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace overview page**

Replace `apps/web/app/page.tsx`:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { authServer } from "@/lib/auth";
import { buildAuthLoginUrl, getRequestBaseUrl } from "@/lib/sso";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function Home() {
  const token = await authServer();
  if (!token) {
    const requestHeaders = await headers();
    redirect(buildAuthLoginUrl(getRequestBaseUrl(requestHeaders)));
  }

  const caller = appRouter.createCaller(await createTRPCContext());
  const summary = await caller.dashboard.summary();

  const cards = [
    { label: "Contacts", value: summary.totalContacts },
    { label: "Conversations", value: summary.totalConversations },
    { label: "Messages", value: summary.totalMessages },
    { label: "Recent API errors", value: summary.recentApiErrors },
  ];

  return (
    <GatewayShell>
      <Stack gap="xs">
        <Text size="xs" tt="uppercase" fw={700} c="dimmed">
          Overview
        </Text>
        <Title order={2}>SleekFlow Gateway Dashboard</Title>
        <Text c="dimmed">Database-backed operational overview for contacts, conversations, messages, and API calls.</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {cards.map((card) => (
          <Card key={card.label} withBorder>
            <Text size="sm" c="dimmed">
              {card.label}
            </Text>
            <Title order={2}>{card.value}</Title>
          </Card>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>Message Direction</Title>
            <Badge variant="light">All time</Badge>
          </Group>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Inbound</Text>
              <Text fw={700}>{summary.inboundMessages}</Text>
            </Group>
            <Group justify="space-between">
              <Text>Outbound</Text>
              <Text fw={700}>{summary.outboundMessages}</Text>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>Last 24h Channels</Title>
            <Badge color="oriskin" variant="light">
              {summary.recentApiCalls} API calls
            </Badge>
          </Group>
          <Stack gap="xs">
            {summary.messagesByChannel.length === 0 ? (
              <Text c="dimmed">No recent messages</Text>
            ) : (
              summary.messagesByChannel.map((item) => (
                <Group key={item.channel} justify="space-between">
                  <Text>{item.channel}</Text>
                  <Text fw={700}>{item._count._all}</Text>
                </Group>
              ))
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </GatewayShell>
  );
}
```

- [ ] **Step 2: Verify overview typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
rtk git add apps/web/app/page.tsx
rtk git commit -m "feat(web): add protected dashboard overview"
```

## Task 11: Add List And Detail Pages

**Files:**
- Create: `apps/web/app/contacts/page.tsx`
- Create: `apps/web/app/contacts/[id]/page.tsx`
- Create: `apps/web/app/conversations/page.tsx`
- Create: `apps/web/app/conversations/[id]/page.tsx`
- Create: `apps/web/app/messages/page.tsx`
- Create: `apps/web/app/messages/[id]/page.tsx`
- Create: `apps/web/app/api-calls/page.tsx`
- Create: `apps/web/app/api-calls/[id]/page.tsx`

- [ ] **Step 1: Add contacts pages**

Create `apps/web/app/contacts/page.tsx`:

```tsx
import Link from "next/link";
import { Anchor, Badge, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { ResourceTable } from "@/components/resource-table";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const caller = appRouter.createCaller(await createTRPCContext());
  const data = await caller.contacts.list({ limit: 50 });

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>Contacts</Title>
        <Text c="dimmed">Channel-aware identities seen by the gateway.</Text>
      </Stack>
      <ResourceTable
        emptyLabel="No contacts found"
        rows={data.items}
        columns={[
          { key: "identity", label: "Identity", render: (row) => <Anchor component={Link} href={`/contacts/${row.id}`}>{row.displayName || row.primaryIdentifier}</Anchor> },
          { key: "channel", label: "Channel", render: (row) => <Badge variant="light">{row.channel}</Badge> },
          { key: "phone", label: "Phone", render: (row) => row.phone || "-" },
          { key: "messages", label: "Messages", render: (row) => row._count.messages },
          { key: "lastSeen", label: "Last Seen", render: (row) => row.lastSeenAt.toLocaleString() },
        ]}
      />
    </GatewayShell>
  );
}
```

Create `apps/web/app/contacts/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, Group, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { JsonView } from "@/components/json-view";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = appRouter.createCaller(await createTRPCContext());
  const contact = await caller.contacts.detail({ id });
  if (!contact) notFound();

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>{contact.displayName || contact.primaryIdentifier}</Title>
        <Text c="dimmed">{contact.channel}</Text>
      </Stack>
      <Card withBorder>
        <Stack>
          <Group justify="space-between"><Text c="dimmed">Phone</Text><Text>{contact.phone || "-"}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Messages</Text><Text>{contact._count.messages}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Conversations</Text><Text>{contact._count.conversations}</Text></Group>
        </Stack>
      </Card>
      <Card withBorder>
        <Title order={4} mb="md">Raw Profile</Title>
        <JsonView value={contact.rawProfile} />
      </Card>
    </GatewayShell>
  );
}
```

- [ ] **Step 2: Add conversations pages**

Create `apps/web/app/conversations/page.tsx`:

```tsx
import Link from "next/link";
import { Anchor, Badge, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { ResourceTable } from "@/components/resource-table";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const caller = appRouter.createCaller(await createTRPCContext());
  const data = await caller.conversations.list({ limit: 50 });

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>Conversations</Title>
        <Text c="dimmed">SleekFlow conversation records linked to contacts.</Text>
      </Stack>
      <ResourceTable
        emptyLabel="No conversations found"
        rows={data.items}
        columns={[
          { key: "conversation", label: "Conversation", render: (row) => <Anchor component={Link} href={`/conversations/${row.id}`}>{row.externalConversationId}</Anchor> },
          { key: "channel", label: "Channel", render: (row) => <Badge variant="light">{row.channel}</Badge> },
          { key: "contact", label: "Contact", render: (row) => row.contact.displayName || row.contact.primaryIdentifier },
          { key: "messages", label: "Messages", render: (row) => row._count.messages },
          { key: "lastMessage", label: "Last Message", render: (row) => row.lastMessageAt?.toLocaleString() || "-" },
        ]}
      />
    </GatewayShell>
  );
}
```

Create `apps/web/app/conversations/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, Group, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { JsonView } from "@/components/json-view";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = appRouter.createCaller(await createTRPCContext());
  const conversation = await caller.conversations.detail({ id });
  if (!conversation) notFound();

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>{conversation.externalConversationId}</Title>
        <Text c="dimmed">{conversation.channel}</Text>
      </Stack>
      <Card withBorder>
        <Stack>
          <Group justify="space-between"><Text c="dimmed">Contact</Text><Text>{conversation.contact.displayName || conversation.contact.primaryIdentifier}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Messages</Text><Text>{conversation._count.messages}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Last Message</Text><Text>{conversation.lastMessageAt?.toLocaleString() || "-"}</Text></Group>
        </Stack>
      </Card>
      <Card withBorder>
        <Title order={4} mb="md">Raw Conversation</Title>
        <JsonView value={conversation.raw} />
      </Card>
    </GatewayShell>
  );
}
```

- [ ] **Step 3: Add messages pages**

Create `apps/web/app/messages/page.tsx`:

```tsx
import Link from "next/link";
import { Anchor, Badge, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { ResourceTable } from "@/components/resource-table";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const caller = appRouter.createCaller(await createTRPCContext());
  const data = await caller.messages.list({ limit: 50 });

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>Messages</Title>
        <Text c="dimmed">Inbound and outbound message history.</Text>
      </Stack>
      <ResourceTable
        emptyLabel="No messages found"
        rows={data.items}
        columns={[
          { key: "message", label: "Message", render: (row) => <Anchor component={Link} href={`/messages/${row.id}`}>{row.messageContent?.slice(0, 80) || row.messageType}</Anchor> },
          { key: "direction", label: "Direction", render: (row) => <Badge variant="light">{row.direction}</Badge> },
          { key: "channel", label: "Channel", render: (row) => row.channel },
          { key: "status", label: "Status", render: (row) => row.status || "-" },
          { key: "created", label: "Created", render: (row) => row.createdAt.toLocaleString() },
        ]}
      />
    </GatewayShell>
  );
}
```

Create `apps/web/app/messages/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, Group, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { JsonView } from "@/components/json-view";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = appRouter.createCaller(await createTRPCContext());
  const message = await caller.messages.detail({ id });
  if (!message) notFound();

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>{message.messageType}</Title>
        <Text c="dimmed">{message.direction} / {message.channel}</Text>
      </Stack>
      <Card withBorder>
        <Stack>
          <Text>{message.messageContent || "No text content"}</Text>
          <Group justify="space-between"><Text c="dimmed">Contact</Text><Text>{message.contact.displayName || message.contact.primaryIdentifier}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Conversation</Text><Text>{message.conversationId || "-"}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Related API Calls</Text><Text>{message.apiCalls.length}</Text></Group>
        </Stack>
      </Card>
      <Card withBorder><Title order={4} mb="md">Analytic Tags</Title><JsonView value={message.analyticTags} /></Card>
      <Card withBorder><Title order={4} mb="md">Raw Payload</Title><JsonView value={message.rawPayload} /></Card>
      <Card withBorder><Title order={4} mb="md">Raw Response</Title><JsonView value={message.rawResponse} /></Card>
    </GatewayShell>
  );
}
```

- [ ] **Step 4: Add API call pages**

Create `apps/web/app/api-calls/page.tsx`:

```tsx
import Link from "next/link";
import { Anchor, Badge, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { ResourceTable } from "@/components/resource-table";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function ApiCallsPage() {
  const caller = appRouter.createCaller(await createTRPCContext());
  const data = await caller.apiCalls.list({ limit: 50 });

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>API Calls</Title>
        <Text c="dimmed">Outbound request and response logs.</Text>
      </Stack>
      <ResourceTable
        emptyLabel="No API calls found"
        rows={data.items}
        columns={[
          { key: "operation", label: "Operation", render: (row) => <Anchor component={Link} href={`/api-calls/${row.id}`}>{row.operation}</Anchor> },
          { key: "status", label: "Status", render: (row) => <Badge color={row.error || (row.responseStatus && row.responseStatus >= 400) ? "red" : "teal"}>{row.responseStatus || "n/a"}</Badge> },
          { key: "url", label: "Request URL", render: (row) => row.requestUrl },
          { key: "message", label: "Message", render: (row) => row.messageId || "-" },
          { key: "created", label: "Created", render: (row) => row.createdAt.toLocaleString() },
        ]}
      />
    </GatewayShell>
  );
}
```

Create `apps/web/app/api-calls/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, Group, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { JsonView } from "@/components/json-view";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function ApiCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = appRouter.createCaller(await createTRPCContext());
  const apiCall = await caller.apiCalls.detail({ id });
  if (!apiCall) notFound();

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>{apiCall.operation}</Title>
        <Text c="dimmed">{apiCall.requestUrl}</Text>
      </Stack>
      <Card withBorder>
        <Stack>
          <Group justify="space-between"><Text c="dimmed">Response Status</Text><Text>{apiCall.responseStatus || "n/a"}</Text></Group>
          <Group justify="space-between"><Text c="dimmed">Linked Message</Text><Text>{apiCall.messageId || "-"}</Text></Group>
          <Text c={apiCall.error ? "red" : "dimmed"}>{apiCall.error || "No error recorded"}</Text>
        </Stack>
      </Card>
      <Card withBorder><Title order={4} mb="md">Request Payload</Title><JsonView value={apiCall.requestPayload} /></Card>
      <Card withBorder><Title order={4} mb="md">Response Payload</Title><JsonView value={apiCall.responsePayload} /></Card>
    </GatewayShell>
  );
}
```

- [ ] **Step 5: Verify pages typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS. If Next route param types differ after `next typegen`, adjust the page signatures to match generated Next 16 types.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add apps/web/app/contacts apps/web/app/conversations apps/web/app/messages apps/web/app/api-calls
rtk git commit -m "feat(web): add dashboard list and detail pages"
```

## Task 12: Add Gateway And Settings Pages

**Files:**
- Create: `apps/web/app/gateway/page.tsx`
- Create: `apps/web/app/settings/page.tsx`

- [ ] **Step 1: Add gateway page**

Create `apps/web/app/gateway/page.tsx`:

```tsx
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { API_BASE_URL } from "@/lib/api";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const caller = appRouter.createCaller(await createTRPCContext());
  const modules = await caller.modules.list();

  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>Gateway</Title>
        <Text c="dimmed">Elysia routes and gateway module capabilities.</Text>
      </Stack>
      <Stack>
        {modules.map((module) => (
          <Card key={module.id} withBorder>
            <Group justify="space-between" align="flex-start">
              <Title order={4}>{module.name}</Title>
              <Badge variant="light">{module.routes.length} routes</Badge>
            </Group>
            <Stack gap={4} mt="md">
              {module.routes.map((route) => (
                <Text key={route} ff="monospace" size="sm">{route}</Text>
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>
      <Text size="sm" c="dimmed">OpenAPI: {API_BASE_URL}/openapi</Text>
    </GatewayShell>
  );
}
```

- [ ] **Step 2: Add settings page**

Create `apps/web/app/settings/page.tsx`:

```tsx
import { Card, Stack, Text, Title } from "@mantine/core";

import { GatewayShell } from "@/components/app-shell";
import { API_BASE_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <GatewayShell>
      <Stack gap={4}>
        <Title order={2}>Settings</Title>
        <Text c="dimmed">Runtime values visible to the dashboard.</Text>
      </Stack>
      <Card withBorder>
        <Stack gap="xs">
          <Text><strong>API base URL:</strong> {API_BASE_URL}</Text>
          <Text><strong>SSO client id:</strong> sleekflow</Text>
          <Text><strong>Auth URL:</strong> configured by AUTH_URL or NEXT_PUBLIC_AUTH_URL</Text>
          <Text><strong>Database:</strong> accessed server-side through packages/database Prisma Client</Text>
        </Stack>
      </Card>
    </GatewayShell>
  );
}
```

- [ ] **Step 3: Verify pages typecheck**

Run:

```bash
rtk bun run check-types --filter=web
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add apps/web/app/gateway apps/web/app/settings
rtk git commit -m "feat(web): add gateway and settings pages"
```

## Task 13: Final Verification

**Files:**
- Inspect: all files changed by this plan.

- [ ] **Step 1: Run focused tests**

Run:

```bash
rtk bun test apps/web/lib/sso.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
rtk bun run check-types
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
rtk bun run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
rtk bun run build
```

Expected: PASS.

- [ ] **Step 5: Start dev server**

Run:

```bash
rtk bun run dev:web
```

Expected: Next.js starts on `http://localhost:4100`. Leave the server running only long enough to smoke-test protected redirect and page rendering, then stop it.

- [ ] **Step 6: Commit final fixes if needed**

If verification required changes, commit them:

```bash
rtk git add apps/web package.json bun.lockb
rtk git commit -m "fix(web): complete sso trpc dashboard verification"
```

If no files changed, do not create an empty commit.

## Self-Review

- Spec coverage: auth, protected root, Mantine theme, app image, tRPC, TanStack Query, Prisma generated types, Elysia boundary, list/detail pages, gateway/settings pages, and verification are each covered by tasks.
- Placeholder scan: no task uses unresolved marker text. Task 11 includes concrete file bodies for each list/detail page group.
- Type consistency: procedure names match the spec: `dashboard.summary`, `contacts.*`, `conversations.*`, `messages.*`, `apiCalls.*`, and `modules.list`.
- Type safety: Task 6 requires Prisma generated types and `satisfies Prisma.*Include`; final verification rejects replacing typed payloads with `any`.
