import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { commonServer } from "./common";

const realtimeServer = {
  ...commonServer,
  REALTIME_PORT: z.coerce.number().int().positive().default(4102),
  REALTIME_TICKET_SECRET: z.string().min(1),
  REALTIME_PUBLISH_API_KEY: z.string().min(1),
} as const;

export function createRealtimeConfig(runtimeEnv: Record<string, string | undefined>) {
  const parsed = createEnv({
    server: realtimeServer,
    runtimeEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });

  return {
    ...parsed,
    port: parsed.REALTIME_PORT,
  };
}

export type RealtimeConfig = ReturnType<typeof createRealtimeConfig>;
