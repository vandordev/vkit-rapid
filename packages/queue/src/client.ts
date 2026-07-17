import { PgBoss } from "pg-boss";

import { jobNames, type JobName } from "./jobs";

export type QueueClient = {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(name: JobName, data?: object | null, options?: SendJobOptions): Promise<string | null>;
  work(name: JobName, handler: (job: unknown) => Promise<unknown>, options?: WorkOptions): Promise<string>;
  schedule(name: JobName, cron: string, data?: object | null): Promise<void>;
};

export type SendJobOptions = { startAfter?: number | string | Date };
export type WorkOptions = { localConcurrency?: number };

type QueueBoss = {
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
  createQueue(name: string): Promise<unknown>;
  send(name: string, data?: object | null, options?: SendJobOptions): Promise<string | null>;
  work(name: string, options: WorkOptions, handler: (job: unknown) => Promise<unknown>): Promise<string>;
  schedule(name: string, cron: string, data?: object | null): Promise<unknown>;
};

export function createQueue(databaseUrl: string, bossFactory: (url: string) => QueueBoss = (url) => new PgBoss(url)): QueueClient {
  const boss = bossFactory(databaseUrl);
  let stopped = false;
  let started: Promise<void> | null = null;

  function assertJobName(name: JobName) {
    if (!jobNames.includes(name)) throw new Error(`Unknown job: ${name}`);
  }

  return {
    async start() {
      if (stopped) throw new Error("Queue has already stopped");
      started ??= (async () => {
        await boss.start();
        await Promise.all(jobNames.map((name) => boss.createQueue(name)));
      })();
      await started;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await boss.stop();
    },
    async send(name, data, options) {
      await this.start();
      assertJobName(name);
      return boss.send(name, data, options);
    },
    async work(name, handler, options = {}) {
      await this.start();
      assertJobName(name);
      return boss.work(name, options, async (job) => handler(job));
    },
    async schedule(name, cron, data) {
      await this.start();
      assertJobName(name);
      await boss.schedule(name, cron, data);
    },
  };
}
