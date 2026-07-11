# SleekFlow Integration Design

## Context

This project is the Elysia/Bun replacement for the existing Python gateway in `../oriskin-gateway-sleekflow`.

The Python gateway already integrates with SleekFlow Flow Builder and the SleekFlow messaging API. It provides:

- `POST /webhook/sleekflow` for inbound Flow Builder webhooks
- `POST /send` for outbound text messages
- `POST /send-media` for outbound media messages
- `POST /send-template` for WhatsApp template messages
- customer timeline and search endpoints
- PostgreSQL persistence for incoming and outgoing messages
- Redis buffering before forwarding inbound messages to the Oriskin API

The new gateway must support both WhatsApp and Instagram in the same SleekFlow account. The design should avoid WhatsApp-specific assumptions such as every contact having a phone number.

## Decisions

- Use Prisma for persistence.
- Put Prisma schema, migrations, generated client access, and database helpers in `packages/database`.
- Keep `apps/api` focused on HTTP routes, validation, SleekFlow integration logic, Redis buffering, and orchestration.
- Expose clean public API paths directly under `/api/*`.
- Keep legacy Python-compatible aliases so existing SleekFlow Flow Builder or internal callers can continue using old paths during migration.
- Store raw inbound payloads and raw SleekFlow API responses for debugging and auditability.
- Treat SleekFlow as the first provider, but model contacts, conversations, and messages in a channel-agnostic way.
- Include Redis buffering in the first implementation, with direct-forward fallback when Redis is unavailable.

## Public API

New API routes:

- `POST /api/webhooks/messages`
- `POST /api/messages`
- `POST /api/messages/media`
- `POST /api/messages/templates`
- `GET /api/contacts`
- `GET /api/contacts/:identifier/timeline`
- `GET /api/conversations`

Compatibility aliases:

- `POST /webhook/sleekflow`
- `POST /send`
- `POST /send-media`
- `POST /send-template`

The compatibility aliases should call the same service functions as the new routes. They must not duplicate business logic.

## Authentication

Inbound webhooks and outbound message endpoints use the same token behavior as the Python gateway:

- `Authorization: Bearer <API_TOKEN>`
- `?token=<API_TOKEN>` for webhook calls that cannot easily set headers

If `API_TOKEN` is not configured, development mode may allow requests and log a warning. Production should require the token.

## Database Package

Create `packages/database` with:

- `prisma/schema.prisma`
- Prisma migration files
- a generated-client wrapper
- repository helpers for contacts, conversations, messages, and API call logs
- package scripts for `prisma generate`, `prisma migrate`, and type checking

`apps/api` imports database helpers from this package. It should not own Prisma schema files.

## Data Model

### `SleekflowContact`

Represents a person or platform contact across WhatsApp and Instagram.

Core fields:

- `id`
- `primaryIdentifier`
- `channel`
- `phone`
- `externalContactId`
- `channelIdentityId`
- `displayName`
- `rawProfile`
- `firstSeenAt`
- `lastSeenAt`
- `createdAt`
- `updatedAt`

Identity selection:

1. `contact.PhoneNumber` or `contact.phone_number`
2. `contact.id`, `contact.contact_id`, or equivalent external contact id
3. `channel_id`
4. fallback to `conversation_id`

The stored `primaryIdentifier` should include channel context when needed, so Instagram and WhatsApp identities cannot collide.

### `SleekflowConversation`

Represents a SleekFlow conversation.

Core fields:

- `id`
- `contactId`
- `channel`
- `sleekflowConversationId`
- `lastMessageAt`
- `raw`
- `createdAt`
- `updatedAt`

### `SleekflowMessage`

Stores both inbound and outbound messages.

Core fields:

- `id`
- `contactId`
- `conversationId`
- `direction`: `inbound` or `outbound`
- `channel`
- `messageType`
- `messageContent`
- `sleekflowMessageId`
- `sleekflowMessageUniqueId`
- `status`
- `fileName`
- `fileUrl`
- `analyticTags`
- `rawPayload`
- `rawResponse`
- `createdAt`
- `updatedAt`

Inbound messages use `rawPayload`. Outbound messages use `rawResponse`.

### `SleekflowApiCall`

Stores outbound request/response details for troubleshooting.

Core fields:

- `id`
- `messageId`
- `operation`
- `requestUrl`
- `requestPayload`
- `responseStatus`
- `responsePayload`
- `error`
- `createdAt`

## Inbound Flow

1. SleekFlow Flow Builder sends a message webhook to `POST /api/webhooks/messages` or the legacy `POST /webhook/sleekflow`.
2. The route verifies the token.
3. The route parses the raw JSON body.
4. The SleekFlow normalizer extracts:
   - `channel`
   - `conversation_id`
   - `message_id`
   - `message_unique_id`
   - `message.message_type`
   - `message.message_content`
   - `is_sent_from_sleekflow`
   - `channel_id`
   - contact identity and display name
5. The service upserts contact and conversation records.
6. The service inserts a `SleekflowMessage` record.
7. If forwarding is enabled and message content exists, the service sends the message into Redis buffering.
8. The route returns a success response containing message and conversation identifiers.

Inbound webhook processing should not fail only because database logging or Oriskin forwarding fails. It should log the error and return an explicit partial status when possible.

## Redis Buffering

Redis buffering is part of the first implementation.

Buffer behavior:

- Buffer key format: `sleekflow:buffer:<channel>:<primaryIdentifier>`
- Buffer content: ordered list of message text values plus metadata needed for forwarding
- TTL: randomized between `BUFFER_TIME_MIN` and `BUFFER_TIME_MAX`, with a small grace window
- Worker interval: checks active buffer keys and forwards messages that are close to expiry
- Forward payload to Oriskin:
  - `customer_phone` when the contact has a phone number
  - `customer_identifier` for non-phone channels such as Instagram
  - `channel`
  - `message`

If Redis cannot connect or a buffer write fails, the service forwards the message to Oriskin immediately. This preserves message flow when buffering infrastructure is unavailable.

## Outbound Text Flow

1. Caller sends `POST /api/messages` or legacy `POST /send`.
2. The route validates:
   - `channel`
   - recipient identifier in `to`
   - optional `from`
   - `messageType`
   - `messageContent`
   - optional `analyticTags`
3. The service creates or finds the contact.
4. The service records a pending outbound message.
5. The SleekFlow client calls `SLEEKFLOW_API_URL` with header `X-Sleekflow-Api-Key`.
6. The service updates the message with status and raw response.
7. The service inserts a `SleekflowApiCall` record.
8. The route returns the SleekFlow response.

## Outbound Media Flow

`POST /api/messages/media` and legacy `POST /send-media` accept multipart form data.

The service sends media to `SLEEKFLOW_SEND_MEDIA_URL` using the same form fields as the Python gateway:

- `channel`
- `to`
- `from`
- `messageType=file`
- `messageContent`
- `analyticTags`
- uploaded file as `files`

The outbound media message is logged with file metadata and raw API response.

## Outbound Template Flow

`POST /api/messages/templates` and legacy `POST /send-template` send template messages through `SLEEKFLOW_API_URL`.

The request supports the existing WhatsApp Cloud API template object shape:

- `extendedMessage.WhatsappCloudApiTemplateMessageObject.templateName`
- `language`
- `components`

The endpoint remains channel-aware so other provider-specific template shapes can be added later without changing the message table.

## Environment

Add API environment variables:

- `DATABASE_URL`
- `SLEEKFLOW_API_URL`
- `SLEEKFLOW_SEND_MEDIA_URL`
- `SLEEKFLOW_API_KEY`
- `SLEEKFLOW_DEFAULT_SENDER`
- `API_TOKEN`
- `REDIS_HOST`
- `REDIS_PORT`
- `BUFFER_TIME_MIN`
- `BUFFER_TIME_MAX`
- `ORISKIN_WEBHOOK_URL`
- `ORISKIN_FORWARDING_ENABLED`

The provided PostgreSQL connection should be represented as `DATABASE_URL`:

```text
postgresql://sleekflow_user:REDACTED@76.13.20.7:5434/sleekflow
```

The real password must stay in local environment files or deployment secrets, not in committed files.

## API Module Layout

Suggested `apps/api` structure:

```text
src/modules/sleekflow/
  client.ts
  normalizer.ts
  schemas.ts
  service.ts
  routes.ts
src/modules/buffer/
  redis.ts
  worker.ts
```

The existing `gatewayRoutes` can remain for service visibility, but real message and webhook functionality should live in focused modules.

## Console Scope

The first implementation may keep web UI changes minimal. The backend should provide enough APIs for the console to later show:

- recent inbound and outbound messages
- contacts
- conversations
- SleekFlow API call failures
- Redis/forwarding status

## Testing

Minimum tests:

- normalizes WhatsApp Flow Builder payloads
- normalizes Instagram Flow Builder payloads without requiring phone numbers
- selects stable buffer keys using `channel + primaryIdentifier`
- inbound webhook route persists a message
- outbound text route builds the expected SleekFlow API payload
- compatibility aliases call the same service behavior as new routes

Verification commands:

- `bun run check-types`
- `bun run lint`
- `bun run build`

## Non-Goals

- no login/auth UI
- no migration of evaluator/reporting features from the Python gateway
- no customer scoring or AI analysis
- no web console redesign beyond what is needed to avoid broken API calls
- no provider abstraction beyond the shape needed to keep WhatsApp and Instagram clean

## Implementation Notes

- Prefer narrow service functions over large route handlers.
- Keep normalizer functions pure and easy to unit test.
- Use raw payload fields defensively because SleekFlow Flow Builder payloads can differ between old automation and new flow builder formats.
- Do not assume `to` and `from` are phone numbers for Instagram.
- Never log full API keys or bearer tokens.
