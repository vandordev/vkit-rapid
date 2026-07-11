import type { QueueClient } from "@repo/queue";

export async function registerSchedules(_queue: Pick<QueueClient, "schedule">): Promise<void> {
  // Product features register enqueue-only schedules here.
}
