import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { app } from "./app";

app.listen(env.port);

logger.info(
  {
    url: `http://localhost:${env.port}`,
    environment: env.NODE_ENV,
    health: `http://localhost:${env.port}/health`,
  },
  "Reusable Elysia API boundary started",
);

export type Server = typeof app;
