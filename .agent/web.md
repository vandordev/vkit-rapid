# Web Rules

- Organize Next.js pages under `app/(public)` and `app/(dashboard)`.
- Use Eden from `apps/web/lib/api`; do not use tRPC, Next API proxies, or ad-hoc `fetch` calls in pages/components.
- Validate web env in `apps/web/lib/env.ts` with `@t3-oss/env-nextjs`.
- The browser may receive `NEXT_PUBLIC_API_URL`; database credentials never belong in web env.
- Keep API data loading in Server Components or typed client hooks; UI components do not import infrastructure packages.
