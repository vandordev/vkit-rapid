# Inbound Destinations Design

## Goal

Replace the single, environment-configured Oriskin forwarding target with database-managed webhook destinations. Each inbound SleekFlow message is delivered to every matching active destination.

## Decisions

- SleekFlow is the only inbound source. No source column or source-routing abstraction is needed.
- Routing is broadcast, not exclusive: an inbound message may be sent to multiple destinations.
- Every active destination with a matching `channel_id` receives the message. A `NULL` `channel_id` matches every SleekFlow channel.
- Inbound messages are buffered once before fan-out. Buffering remains conversation-based and is not duplicated per destination.
- Failures are isolated per destination: a failed request to one target must not prevent delivery attempts to other targets.
- The existing payload shape is retained for every target. Per-destination payload templates and transformations are out of scope.
- `ORISKIN_WEBHOOK_URL` and `ORISKIN_FORWARDING_ENABLED` are removed from environment validation, example environment files, documentation, and runtime logic.

## Data Model

Add Prisma model `InboundDestination`, mapped to `inbound_destinations`.

| Column | Type | Rules | Purpose |
| --- | --- | --- | --- |
| `id` | UUID | primary key | Destination identity |
| `name` | string | unique, required | Human-readable destination name |
| `webhook_url` | string | required | HTTPS endpoint that receives the inbound payload |
| `is_active` | boolean | required, defaults to `true` | Enables or disables delivery without deleting configuration |
| `channel_id` | string | nullable, indexed | Limits delivery to one SleekFlow channel; `NULL` means all channels |
| `headers` | JSON | nullable | Optional non-secret HTTP headers sent with the request |
| `created_at` | timestamp | required | Creation audit timestamp |
| `updated_at` | timestamp | required | Last-update audit timestamp |

`headers` is intentionally limited to non-secret metadata. Authentication secrets continue to be supplied through the deployment environment or a future secrets mechanism; they are not stored in plaintext in this table.

The migration seeds one active row named `Oriskin Chatbot`, using the current default Oriskin webhook URL. This preserves current delivery behavior after the environment variables are removed.

## Runtime Flow

```text
SleekFlow webhook
  -> normalize and persist inbound message
  -> append message to the Redis conversation buffer
  -> flush the buffer when its due time is reached
  -> query matching active inbound destinations
  -> POST the buffered payload to every destination independently
  -> record each delivery attempt in api_calls
```

If Redis is unavailable, the existing direct-forward fallback remains, but it now queries and fans out to matching destinations before returning.

The matching query is:

```text
is_active = true
AND (channel_id IS NULL OR channel_id = inbound channel_id)
```

## Delivery Behavior

The payload remains compatible with the existing Oriskin integration:

```json
{
  "customer_phone": "+628...",
  "customer_identifier": "phone:+628...",
  "channel": "whatsapp",
  "message": "...buffered inbound text..."
}
```

Delivery executes concurrently and waits for all destination attempts to settle. A network failure, timeout, or non-success response is logged for that destination only. Other destinations continue receiving the same payload.

The current buffer worker deletes a successfully processed buffer after the fan-out attempt cycle. This change does not introduce durable per-destination retries. Reliable retry, per-target delivery states, and replay would require a separate `inbound_delivery_attempts` table or queue and are deliberately deferred.

## Code Boundaries

- `packages/database/prisma/schema.prisma`: owns the new persistence model.
- `packages/database/src/repositories/inbound-destinations.ts`: owns the focused query for active destinations matching a channel.
- `apps/api/src/modules/buffer/worker.ts`: owns buffer flush, destination fan-out, request execution, and per-destination logging.
- `apps/api/src/lib/env.ts`: removes obsolete Oriskin forwarding configuration.
- Environment examples and README: remove references to those environment variables and describe database-managed destinations instead.

## Verification

Tests must cover:

1. A global active destination receives an inbound buffered message.
2. Several matching destinations each receive the same payload.
3. A destination scoped to a different `channel_id` does not receive the payload.
4. An inactive destination does not receive the payload.
5. One failed destination does not stop an attempted delivery to another destination.
6. Redis-unavailable direct forwarding follows the same matching and fan-out behavior.
7. Environment parsing succeeds without `ORISKIN_WEBHOOK_URL` or `ORISKIN_FORWARDING_ENABLED`.

## Non-Goals

- Supporting inbound sources other than SleekFlow.
- Destination-specific payload mappings, filtering beyond `channel_id`, or ordering rules.
- A UI for managing destinations.
- Storage of credentials or secrets in the database.
- Guaranteed retries, replay, or exactly-once delivery semantics.
