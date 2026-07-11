import type { QueueClient } from "@repo/queue";

export async function registerHandlers(_queue: Pick<QueueClient, "work">): Promise<void> {
  // Product features register named handlers here.
}
