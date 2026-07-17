# Worker Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local worker concurrency to the queue contract and document a safe feature-owned outbox recovery recipe.

**Architecture:** `@repo/queue` stays a thin pg-boss adapter and forwards typed send/work options. Leases and recovery remain feature-owned, described in a tested recipe rather than a baseline Prisma model or scheduled job.

**Tech Stack:** TypeScript, pg-boss, Bun test, Prisma transaction patterns.

---

## File structure

- Modify: `packages/queue/src/client.ts` — option types, idempotent startup, option forwarding.
- Create: `packages/queue/src/client.test.ts` — injected pg-boss boundary tests.
- Create: `docs/worker-reliability.md` — domain-neutral lease/outbox recipe.
- Modify: `.agent/worker.md`, `.agent/scheduler.md`, `README.md`.

### Task 1: Add queue option types and idempotent startup

**Files:** `packages/queue/src/client.ts`, `packages/queue/src/client.test.ts`.

- [ ] **Step 1: Write the failing queue-boundary test**

```ts
test("forwards local concurrency when registering a worker", async () => {
  const calls: unknown[] = [];
  const queue = createQueue("postgres://test", () => fakeBoss({
    work: (_name, options) => { calls.push(options); return Promise.resolve("id"); },
  }));
  await queue.work("example", async () => undefined, { localConcurrency: 2 });
  expect(calls).toEqual([{ localConcurrency: 2 }]);
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test packages/queue/src/client.test.ts`  
Expected: FAIL because `createQueue` has no injectable factory and `work` has no options parameter.

- [ ] **Step 3: Implement the minimal typed boundary**

```ts
export type SendJobOptions = { startAfter?: number | string | Date };
export type WorkOptions = { localConcurrency?: number };

work(name, handler, options = {}) {
  assertJobName(name);
  return boss.work(name, options, async (job) => handler(job));
}
```

Add a lazily memoized `start()` promise that starts pg-boss once and creates every name in `jobNames`, then call it before `send`, `work`, and `schedule`.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk task test:queue`  
Expected: PASS.

```bash
git add packages/queue/src/client.ts packages/queue/src/client.test.ts
git commit -m "feat(queue): support per-worker concurrency"
```

### Task 2: Publish the lease and recovery recipe

**Files:** `docs/worker-reliability.md`, `.agent/worker.md`, `.agent/scheduler.md`, `README.md`.

- [ ] **Step 1: Add a conditional recovery example and executable pseudo-test**

```ts
const update = await db.outbox.updateMany({
  where: { id: row.id, state: "PROCESSING", availableAt: { lt: now } },
  data: { state: "PENDING", availableAt: now, lastError: "Processing lease expired" },
});
if (update.count === 1) await queue.send("feature-publish", { id: row.id });

expect(await recoverExpiredLeases()).toEqual({ recovered: 1 });
expect(queue.send).toHaveBeenCalledWith("feature-publish", { id: "outbox-1" });
```

- [ ] **Step 2: Record the fixed lifecycle and boundaries**

```md
1. Persist business state and the outbox intent in one transaction.
2. Conditionally claim the intent with a lease deadline.
3. Perform the side effect with an idempotency key.
4. Return retryable failures to pending with a next availability time.
5. Requeue only conditionally expired leases through a feature-owned recovery schedule.
```

- [ ] **Step 3: Verify and commit**

Run: `rtk git diff --check && rtk task test:queue`  
Expected: both commands exit `0`.

```bash
git add docs/worker-reliability.md .agent/worker.md .agent/scheduler.md README.md
git commit -m "docs: add reliable worker side-effect recipe"
```

