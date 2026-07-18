# Configuration Rules

- Committed `config/*.yaml` modules are the primary configuration source. A runtime explicitly selects its modules and their merge order; module names do not imply runtime ownership.
- Merge selected modules left-to-right. Plain objects deep-merge; later arrays, scalars, and `null` replace earlier values.
- YAML may contain only `${NAME}` or `${NAME:-fallback}` interpolation. It resolves once against the process environment after merging. A missing or empty required value fails before Zod validation.
- Never place a secret literal in YAML. Developers copy `.env.example` to the one ignored root `.env`; production injects the same values through its deployment platform or secret manager.
- Server runtimes use the YAML wrapper and typed factories from `@repo/config` backed by `@t3-oss/env-core`. Add a key to the smallest runtime schema that needs it.
- Next.js uses `@t3-oss/env-nextjs`. The wrapper must run before `next dev` and `next build`; browser code may receive only resolved `NEXT_PUBLIC_*` values.
- Embedded Elysia routes in Next.js require `DATABASE_URL` as a server-only web value. Never place it in the client schema or expose it with `NEXT_PUBLIC_`.
- Optional S3/MinIO and realtime credentials stay server-only. Validate them through `createStorageConfig` and `createRealtimeConfig` respectively.
