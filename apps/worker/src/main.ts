import { createWorkerConfig } from "@repo/config";
import { createQueue } from "@repo/queue";

import { registerHandlers } from "./handlers";

const config = createWorkerConfig(process.env);
const queue = createQueue(config.DATABASE_URL);

await queue.start();
await registerHandlers(queue);

async function shutdown() {
  await queue.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
