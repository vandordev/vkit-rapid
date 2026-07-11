# Database Rules

- Only `packages/database` creates or exports the Prisma client.
- Schema changes belong in `packages/database/prisma/schema.prisma` and must have a Prisma migration.
- Never add product models to the boilerplate; domain models are introduced by the consuming project.
- Usecases own Prisma writes and transactions. Routes must not duplicate mutation rules.
- Keep list queries bounded and add indexes when a feature introduces frequently filtered fields.
