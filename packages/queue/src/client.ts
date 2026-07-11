import { PgBoss } from "pg-boss";

import { jobNames, type JobName } from "./jobs";

export type QueueClient = {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(name: JobName, data?: object | null): Promise<string | null>;
  work(name: JobName, handler: (job: unknown) => Promise<unknown>): Promise<string>;
  schedule(name: JobName, cron: string, data?: object | null): Promise<void>;
};

export function createQueue(databaseUrl: string): QueueClient {
  const boss = new PgBoss(databaseUrl);
  let stopped = false;

  function assertJobName(name: JobName) {
    if (!jobNames.includes(name)) throw new Error(`Unknown job: ${name}`);
  }

  return {
    async start() {
      await boss.start();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await boss.stop();
    },
    async send(name, data) {
      assertJobName(name);
      return boss.send(name, data);
    },
    async work(name, handler) {
      assertJobName(name);
      return boss.work(name, async (job) => handler(job));
    },
    async schedule(name, cron, data) {
      assertJobName(name);
      await boss.schedule(name, cron, data);
    },
  };
}
