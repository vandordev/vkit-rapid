import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const commonServer = {
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1),
  LOG_LEVEL: z.string().default("info"),
} as const;

export function assertProductionDatabaseConfig(
  nodeEnv: string,
  runtimeEnv: Record<string, string | undefined>,
) {
  if (nodeEnv === "production" && !runtimeEnv.DATABASE_URL) {
    throw new Error("DATABASE_URL must be explicitly configured in production");
  }
}

export function createCommonConfig(
  runtimeEnv: Record<string, string | undefined>,
) {
  const parsed = createEnv({
    server: commonServer,
    runtimeEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });

  assertProductionDatabaseConfig(parsed.NODE_ENV, runtimeEnv);
  return parsed;
}

export type CommonConfig = ReturnType<typeof createCommonConfig>;
