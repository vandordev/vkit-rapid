# Scheduler Rules

- Schedulers own time expressions and enqueue options only.
- Schedulers must never import Prisma or application usecases.
- Every schedule targets a named queue job and can be tested with a fake queue boundary.
- Keep schedules idempotent and safe to register more than once.
