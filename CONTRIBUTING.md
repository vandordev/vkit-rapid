# Contributing

Read `AGENTS.md` and the relevant files in `.agent/` before changing the repository.

Keep the default runtime focused on `apps/web` and `apps/api`. Add `apps/worker`, `apps/scheduler`, and `packages/queue` only when a feature needs durable asynchronous jobs.

Before opening a change, run:

```bash
task quality
task build
```

Use focused tests while developing. Keep changes scoped to the owning workspace, update documentation when reusable architecture changes, and do not commit secrets or local environment files.
