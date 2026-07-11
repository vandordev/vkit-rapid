# API Rules

- Keep Elysia route modules under `apps/api/src/routes` and compose them from `src/app.ts`.
- Business routes use `/api/<resource>`; `/health` is reserved for process health.
- Query routes may use Prisma directly for transport-specific read shapes.
- Mutation routes validate input, call a usecase, and map results to the standard response envelope.
- Success responses are `{ success: true, data }`; failures are `{ success: false, error, message, requestId? }`.
- Use Elysia schemas for request and response contracts and `AppError` for expected domain failures.
- Export `type App = typeof app` without starting the server when the module is imported.
- Keep the app factory transport-agnostic so it can be used by both `apps/api/src/server.ts` and the Next.js catch-all Route Handler.
