import { createCommonConfig } from "./common";

export function createWorkerConfig(runtimeEnv: Record<string, string | undefined>) {
  return createCommonConfig(runtimeEnv);
}

export type WorkerConfig = ReturnType<typeof createWorkerConfig>;
