import type { QueueClient } from "@repo/queue";

export async function registerHandlers(queue: Pick<QueueClient, "work">): Promise<void> {
  void queue;
  // Product features register named handlers here.
}
