import { createRealtimeConfig } from "@repo/config";

import { createTicketAuthenticator } from "./auth";
import { createRealtimeServer } from "./server";

const config = createRealtimeConfig(process.env);
const runtime = createRealtimeServer({
  publishApiKey: config.REALTIME_PUBLISH_API_KEY,
  authenticate: createTicketAuthenticator(config.REALTIME_TICKET_SECRET),
  authorizeWorkspace: async () => false,
});

await runtime.listen(config.port, "0.0.0.0");

async function shutdown() {
  await runtime.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
