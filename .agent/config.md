# Configuration Rules

- Server runtimes use typed loaders from `@repo/config` backed by `@t3-oss/env-core`.
- Next.js uses `@t3-oss/env-nextjs` because public values are bundled at build time.
- Keep separate `.env.api`, `.env.web`, `.env.worker`, and `.env.scheduler` files.
- Add a key to the smallest runtime schema that needs it; do not create a global unscoped env object.
