import { createSchedulerConfig } from "@repo/config";
import { createQueue } from "@repo/queue";

import { registerSchedules } from "./schedules";

const config = createSchedulerConfig(process.env);
const queue = createQueue(config.DATABASE_URL);

await queue.start();
await registerSchedules(queue);

async function shutdown() {
  await queue.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
