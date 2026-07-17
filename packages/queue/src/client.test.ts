import { expect, test } from "bun:test";

import { createQueue } from "./client";
import { jobNames } from "./jobs";

test("forwards local concurrency when registering a worker", async () => {
  (jobNames as unknown as string[]).push("example");
  const calls: unknown[] = [];
  const queue = createQueue("postgresql://test", () => ({
    start: async () => undefined,
    stop: async () => undefined,
    createQueue: async () => undefined,
    send: async () => null,
    work: async (_name: string, options: unknown) => { calls.push(options); return "worker"; },
    schedule: async () => undefined,
  }));

  await queue.work("example" as never, async () => undefined, { localConcurrency: 2 });

  expect(calls).toEqual([{ localConcurrency: 2 }]);
  (jobNames as unknown as string[]).pop();
});
