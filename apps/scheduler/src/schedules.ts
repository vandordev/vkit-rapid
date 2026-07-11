import type { QueueClient } from "@repo/queue";

export async function registerSchedules(queue: Pick<QueueClient, "schedule">): Promise<void> {
  void queue;
  // Product features register enqueue-only schedules here.
}
