# Legacy SleekFlow Contract Inventory

This inventory freezes the current gateway surface before cleanup. No production route or database table is removed solely because it appears here; each retirement is a deliberate cutover decision.

## Retain

| Surface | Current path | Disposition |
| --- | --- | --- |
| Elysia health | `GET /health` and `GET /health/ready` | Retain in `apps/api`. |
| Elysia process | API container on port `4101` | Retain as the external health boundary. |
| PostgreSQL schema | Existing SleekFlow tables | Preserve during cleanup; no destructive migration. |
| Workbook reference | `docs/*.xlsx` | Retain as historical/reference input, not runtime data. |

## Retire From the Active Application

| Surface | Current path/module | Reason |
| --- | --- | --- |
| Gateway demo services | `GET /gateway/services` | SleekFlow console-only surface. |
| Gateway demo activity | `GET /gateway/activity` | SleekFlow console-only surface. |
| Inbound webhook | `POST /webhook/messages`, `POST /webhook/sleekflow`, `POST /api/webhooks/messages` | Messaging gateway responsibility outside task-management MVP. |
| Outbound text | `POST /send`, `POST /api/messages` | Messaging gateway responsibility outside task-management MVP. |
| Outbound media | `POST /send-media`, `POST /api/messages/media` | Messaging gateway responsibility outside task-management MVP. |
| Outbound template | `POST /send-template`, `POST /api/messages/templates` | Messaging gateway responsibility outside task-management MVP. |
| Contact queries | `GET /api/contacts`, `GET /api/contacts/:identifier/timeline` | SleekFlow console-only surface. |
| Conversation queries | `GET /api/conversations` | SleekFlow console-only surface. |
| Message/buffer modules | `apps/api/src/modules/messages/*`, `apps/api/src/modules/buffer/*` | No longer active in the task-management runtime. |
| Gateway route module | `apps/api/src/routes/gateway.ts` | No longer active in the task-management runtime. |

## Next.js Namespace Migration

The following internal Next.js handlers move from `/api/*` to `/nextapi/*`:

| Current | New |
| --- | --- |
| `/api/trpc/*` | `/nextapi/trpc/*` |
| `/api/auth/callback` | `/nextapi/auth/callback` |
| `/api/auth/logout` | `/nextapi/auth/logout` |
| `/api/backends/*` | `/nextapi/backends/*` |

The `/api/*` namespace is reserved for Elysia external routes. The existing Next.js fallback rewrite to the API service is removed.

## Environment Retirement

The API cleanup removes SleekFlow forwarding and message-buffer variables only after the route removal is verified. The canonical local files become root `.env.api` and `.env.web`; actual secret values are never copied into this inventory.

## Deployment Notes

- The API health check remains `http://127.0.0.1:4101/health`.
- The web container owns `/nextapi/*`; the API container does not receive those requests.
- Production deployment rules must be reviewed before removing gateway paths from Traefik.
- The production ticketing database is not accessed by this repository.
