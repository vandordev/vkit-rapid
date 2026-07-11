import { createCommonConfig } from "./common";

export function createSchedulerConfig(runtimeEnv: Record<string, string | undefined>) {
  return createCommonConfig(runtimeEnv);
}

export type SchedulerConfig = ReturnType<typeof createSchedulerConfig>;
