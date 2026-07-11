# SSO tRPC Dashboard Design

## Context

`apps/web` is a Next.js 16 app that already uses Mantine. It currently renders a simple gateway console with sidebar navigation and health/activity panels. The project database package already owns Prisma schema, migrations, Prisma client access, and generated Prisma model types.

The next phase is an authenticated operational dashboard for SleekFlow Gateway. The dashboard should represent the project's actual modules and database tables: contacts, conversations, messages, API calls, gateway routes, and runtime health.

Auth should follow the Oriskin SSO pattern used by `../evoucher/oriskin-evoucher-web`, with this project's SSO client id set to `sleekflow`.

## Decisions

- Protect root `/` directly. There is no public landing page.
- Use Oriskin SSO for web dashboard auth.
- Use `client_id=sleekflow` when building the SSO login URL.
- Use Mantine for the dashboard shell, pages, tables, forms, empty states, and notifications.
- Adapt the evoucher `globals.css` visual tokens to Mantine theme values instead of importing shadcn/Tailwind theme plumbing.
- Copy the evoucher app image from `../evoucher/oriskin-evoucher-web/public/images/app-logo.png` into this web app and use it in the dashboard header/sidebar.
- Use tRPC in Next.js for internal dashboard data access.
- Use TanStack Query with tRPC for client-side cache, loading states, refetching, and paginated list pages.
- Let Next.js tRPC procedures access Prisma directly through `packages/database`.
- Keep Elysia as the service/backend integration API for SleekFlow webhooks, outbound messages, health, OpenAPI, and backend service consumers.

## Architecture

The dashboard has two API boundaries:

1. Next.js tRPC is the internal dashboard read API.
2. Elysia remains the external and service-to-service gateway API.

This avoids adding dashboard-only REST endpoints to Elysia. The web app can query read models directly from Prisma while Elysia keeps a stable contract for external callers and other backend services.

`apps/web` should add:

- auth helpers for token cookies, refresh, SSO URL construction, and callback exchange;
- tRPC server setup with protected procedures;
- TanStack Query and tRPC client providers;
- list and detail pages for the main persisted resources;
- a Mantine dashboard shell with sidebar navigation.

`packages/database` remains the single source for Prisma client and generated Prisma types. Dashboard code should import from `@repo/database`, not instantiate a separate Prisma client.

## Auth Flow

Root `/` and all dashboard routes are protected server-side.

1. A protected layout/page calls `authServer()`.
2. `authServer()` checks an access token cookie.
3. If the access token is missing, it checks a refresh token cookie and attempts refresh through Oriskin SSO.
4. If no valid token is available, the user is redirected to Oriskin Auth.
5. The login URL includes:
   - `client_id=sleekflow`
   - `redirect_url=<current-base-url>/callback`
6. `/callback` forwards the query string to `/api/auth/callback`.
7. `/api/auth/callback` exchanges the SSO `code` for access and refresh tokens.
8. Tokens are stored in `sleekflow_gateway_token` and `sleekflow_gateway_session` cookies.
9. The user is redirected back to `/`.

The token exchange should use the same BFF-compatible pattern as evoucher. When running behind a gateway that exposes `/api/backends/auth/api/sso`, the callback should prefer that base URL for `/token`. Refresh can use the configured auth URL `/api/sso/refresh`.

Token exchange or refresh failure should not render partial dashboard content. It should redirect back to login.

## tRPC Design

All tRPC procedures are protected. A request without a valid dashboard token should receive an unauthorized tRPC error. Server-rendered pages should redirect before rendering when auth is missing.

Procedure names:

- `dashboard.summary`
- `contacts.list`
- `contacts.detail`
- `conversations.list`
- `conversations.detail`
- `messages.list`
- `messages.detail`
- `apiCalls.list`
- `apiCalls.detail`
- `modules.list`

`dashboard.summary` returns aggregate operational metrics:

- total contacts;
- total conversations;
- total messages;
- inbound and outbound message counts;
- recent message counts by channel;
- recent API call count;
- recent API error count;
- latest activity timestamps.

List procedures should support:

- `limit`;
- cursor or page pagination;
- search where relevant;
- domain filters where relevant, such as channel, direction, status, operation, and response status.

Detail procedures should accept `id` and return either the record with relevant relations or a typed not-found error.

## Type Safety

Dashboard data access must use Prisma generated types from `@prisma/client` through `packages/database`.

Rules:

- Use Prisma Client generated model and payload types, such as `Contact`, `Message`, `ApiCall`, `Prisma.ContactGetPayload`, `Prisma.MessageGetPayload`, and typed `select`/`include` helpers.
- Prefer `Prisma.validator` or `satisfies Prisma.*Args` for reusable include/select shapes.
- Do not duplicate Prisma model shapes as broad manual DTOs unless the procedure intentionally returns a smaller view model.
- If a smaller view model is needed, derive it from typed Prisma payloads and keep the mapping local and explicit.
- Avoid `any` for procedure outputs, repository returns, and table row types.
- Infer client types from `AppRouter` and tRPC hooks instead of manually re-declaring response types in React components.

This keeps list rows, detail payloads, and relation data aligned with the generated Prisma schema.

## Pages And Navigation

The sidebar navigates to pages, not in-page anchors:

- `/` for overview;
- `/contacts` and `/contacts/[id]`;
- `/conversations` and `/conversations/[id]`;
- `/messages` and `/messages/[id]`;
- `/api-calls` and `/api-calls/[id]`;
- `/gateway` for modules, route capabilities, service status, and OpenAPI access;
- `/settings` for environment and integration visibility.

Desktop should show a persistent sidebar. Mobile should collapse the sidebar behind a burger button. The header should show the app image, product name, API status, and a logout action.

## Page Behavior

### Overview

Overview shows dashboard-wide metrics and recent activity:

- KPI cards for contacts, conversations, messages, and API failures;
- inbound/outbound split;
- channel distribution;
- latest messages;
- latest API call errors;
- gateway health and OpenAPI link.

### Contacts

The contacts list shows primary identifier, channel, phone, display name, last seen time, message count, and conversation count.

Contact detail shows:

- identity and profile fields;
- related conversations;
- recent message timeline;
- raw profile JSON when available.

### Conversations

The conversations list shows channel, external conversation id, contact summary, last message time, and message count.

Conversation detail shows:

- conversation metadata;
- linked contact;
- messages in the conversation;
- raw conversation JSON when available.

### Messages

The messages list shows direction, channel, type, content preview, status, contact, conversation, and created time.

Message detail shows:

- message metadata;
- full content;
- related contact and conversation;
- analytic tags;
- raw payload and raw response JSON;
- related API calls.

### API Calls

The API calls list shows operation, response status, error state, request URL, linked message, and created time.

API call detail shows:

- request URL and operation;
- response status;
- error text;
- request payload JSON;
- response payload JSON;
- linked message summary when available.

### Gateway

Gateway shows module and route capabilities from the codebase:

- inbound webhooks;
- outbound text send;
- outbound media send;
- outbound template send;
- contacts and conversations API;
- Redis buffer worker;
- health and OpenAPI.

This page may combine static module metadata with live health checks from Elysia.

## Theme

The Mantine theme should adapt the evoucher shadcn tokens into Mantine values:

- primary color: Oriskin coral/red family from evoucher primary token;
- secondary accent: muted blue from evoucher secondary token;
- radius: approximately `10px`, matching evoucher `0.625rem`;
- background: clean white/off-white;
- sidebar: light neutral with coral-tinted active state;
- typography: keep the current Space Grotesk setup unless a project decision later changes fonts.

The app should not import evoucher Tailwind, shadcn, or preset CSS. Only the visual direction and app image are reused.

## Error Handling

- Missing auth redirects to Oriskin SSO.
- Failed token exchange redirects to Oriskin SSO.
- Failed refresh makes the user unauthenticated.
- tRPC unauthorized errors should not expose token contents.
- List pages should show Mantine empty/error states when queries fail.
- Detail pages should show a not-found state for missing records.
- JSON payload blocks should handle null/empty payloads cleanly.

## Testing And Verification

Minimum implementation verification:

- auth URL builder uses `client_id=sleekflow` and the current request base URL;
- callback route stores token and session cookies with secure/lax/path settings;
- protected tRPC procedure rejects unauthenticated requests;
- list/detail repository queries compile against generated Prisma types;
- `bun run check-types`;
- `bun run lint`;
- `bun run build`;
- dashboard renders locally with protected root behavior.

## Non-Goals

- No write/edit/delete operations for contacts, conversations, messages, or API calls.
- No role-based dashboard authorization beyond valid Oriskin SSO auth.
- No migration of service-to-service APIs from Elysia to tRPC.
- No shadcn UI dependency for the new dashboard.
- No public marketing or landing page.
