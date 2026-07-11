import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { commonServer } from "./common";

const apiServer = {
  ...commonServer,
  PORT: z.coerce.number().int().positive().default(4101),
  CORS_ORIGIN: z.string().url().default("http://localhost:4100"),
} as const;

export function createApiConfig(runtimeEnv: Record<string, string | undefined>) {
  const parsed = createEnv({
    server: apiServer,
    runtimeEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });

  return {
    ...parsed,
    port: parsed.PORT,
    corsOrigin: parsed.CORS_ORIGIN,
  };
}

export type ApiConfig = ReturnType<typeof createApiConfig>;
