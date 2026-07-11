# Configuration Rules

- Server runtimes use typed loaders from `@repo/config` backed by `@t3-oss/env-core`.
- Next.js uses `@t3-oss/env-nextjs` because public values are bundled at build time.
- Embedded Elysia routes in Next.js require `DATABASE_URL` as a server-only web variable; never place it in the `client` schema or expose it with `NEXT_PUBLIC_`.
- Keep separate `.env.api`, `.env.web`, `.env.worker`, and `.env.scheduler` files.
- Add a key to the smallest runtime schema that needs it; do not create a global unscoped env object.
