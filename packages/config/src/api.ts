import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { assertProductionDatabaseConfig, commonServer } from "./common";

const apiServer = {
  ...commonServer,
  PORT: z.coerce.number().int().positive().default(4101),
  CORS_ORIGIN: z.string().url().default("http://localhost:4100"),
  OPENAPI_BASIC_AUTH_USERNAME: z.string().min(1).optional(),
  OPENAPI_BASIC_AUTH_PASSWORD: z.string().min(1).optional(),
} as const;

export function createApiConfig(
  runtimeEnv: Record<string, string | undefined>,
) {
  const parsed = createEnv({
    server: apiServer,
    runtimeEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });

  assertProductionDatabaseConfig(parsed.NODE_ENV, runtimeEnv);

  if (Boolean(parsed.OPENAPI_BASIC_AUTH_USERNAME) !== Boolean(parsed.OPENAPI_BASIC_AUTH_PASSWORD)) {
    throw new Error("OPENAPI_BASIC_AUTH_USERNAME and OPENAPI_BASIC_AUTH_PASSWORD must be configured together");
  }

  return {
    ...parsed,
    port: parsed.PORT,
    corsOrigin: parsed.CORS_ORIGIN,
  };
}

export type ApiConfig = ReturnType<typeof createApiConfig>;
