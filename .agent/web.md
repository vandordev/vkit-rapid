# Web Rules

- Organize Next.js pages under `app/(public)` and `app/(dashboard)`.
- Use Eden from `apps/web/lib/api`; the server client may use `treaty(app).api`, while browser calls use the same-origin `/api/*` Route Handler. Do not use tRPC, rewrites, or ad-hoc `fetch` calls in pages/components.
- Keep `app/api/[[...slugs]]/route.ts` as a thin adapter that exports Elysia `app.fetch` for supported HTTP methods.
- Validate web env in `apps/web/lib/env.ts` with `@t3-oss/env-nextjs`.
- The browser may receive `NEXT_PUBLIC_APP_URL`; database credentials never belong in web env.
- Keep API data loading in Server Components or typed client hooks; UI components do not import infrastructure packages.
