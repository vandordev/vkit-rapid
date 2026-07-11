import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const commonServer = {
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://localhost:5432/postgres"),
  LOG_LEVEL: z.string().default("info"),
} as const;

export function createCommonConfig(runtimeEnv: Record<string, string | undefined>) {
  return createEnv({
    server: commonServer,
    runtimeEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });
}

export type CommonConfig = ReturnType<typeof createCommonConfig>;
