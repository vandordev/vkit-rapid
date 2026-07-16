# Worker Reliability Recipe Design

## Goal

Provide reusable queue-level primitives and documented patterns for reliable external side effects without adding a product outbox schema to the baseline.

## Scope

- Extend the queue contract so worker registrations can set local concurrency.
- Provide a small, framework-neutral lease recovery helper contract/example for feature-owned outbox records.
- Document the required lifecycle: transactionally persist intent, claim with a lease, execute at-least-once, classify failure, retry, and recover expired claims.
- Add worker logging guidance and focused contract tests.

## Design

`@repo/queue` owns only generic queue operations and forwards `localConcurrency` to pg-boss. Feature packages own their own persistence model and claim/update queries because state names, idempotency keys, retention, and retry policy are product decisions.

The baseline exposes no `OutboundMessage` Prisma model, no named business job, and no schedule. Instead, an architecture guide defines the invariant that a scheduler may enqueue a recovery job, while the worker owns retry policy, idempotency, structured lifecycle logs, and recovery execution. Recovery must use a conditional update so multiple workers cannot requeue the same expired lease.

## Non-goals

- A generic Prisma outbox table.
- Global retry delays or HTTP-status classifications.
- A default scheduler job.

## Verification

- Queue tests prove local concurrency reaches the pg-boss boundary.
- A documented example includes tests for conditional recovery semantics.
