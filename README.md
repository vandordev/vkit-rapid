# Oriskin Task Management

Internal work-management system for Oriskin IT. It manages FS/TO delivery, approval, weekly planning, dependencies, Solution activity, daily huddles, and owner-ready Excel reports.

## Architecture

- Next.js/Mantine web console: internal UI and tRPC API under `/nextapi/*`.
- Usecase commands: shared state-changing business rules.
- Prisma/PostgreSQL: task-management persistence and direct transport-specific read queries.
- Elysia/Bun: external boundary; currently only `/health` is active. The `/api/*` namespace is reserved for future external integrations.

The application does not connect to the production ticketing database. GitHub evidence is planned for phase two.

## Local Development

```bash
bun install --ignore-scripts
cp .env.api.example .env.api
cp .env.web.example .env.web
bun run dev
```

Web: http://localhost:4100  
Elysia health: http://localhost:4101/health

The web runtime reads `.env.web`, including server-side `DATABASE_URL` for tRPC procedures. The Elysia runtime reads `.env.api`. Real environment files are ignored by Git.

## Environment Files

```text
.env.api.example  # tracked, Elysia/external boundary template
.env.web.example  # tracked, Next.js/tRPC server and browser-safe template
.env.api          # local/production secret file, ignored
.env.web          # local/production secret file, ignored
```

Do not commit passwords, tokens, database URLs, or production credentials. Use a dedicated read-only account for any future external integration.

## Commands

- `bun run dev`
- `bun run dev:web`
- `bun run dev:api`
- `bun run build`
- `bun run lint`
- `bun run check-types`
- `bun test`

## Repository Layout

- `apps/web` - Next.js console, tRPC procedures, and internal `/nextapi` handlers
- `apps/api` - Elysia external boundary and `/health`
- `packages/database` - Prisma schema, generated client, and database configuration
- `packages/application` - shared command usecases as task-management features are added
- `docs` - design specs, implementation plans, roadmap, and historical workbook references

## Reports

Weekly and monthly owner reports are generated from application data. The workbook reference in `docs/TASK LIST DEPT IT.xlsx` is historical input for mapping and validation; it is not loaded at runtime.
