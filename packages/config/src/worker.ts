import { createEnv } from "@t3-oss/env-core";

import { assertProductionDatabaseConfig, commonServer } from "./common";
import { createStorageConfig, storageServer } from "./storage";

export function createWorkerConfig(runtimeEnv: Record<string, string | undefined>) {
  const parsed = createEnv({
    server: { ...commonServer, ...storageServer },
    runtimeEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });

  assertProductionDatabaseConfig(parsed.NODE_ENV, runtimeEnv);

  return { ...parsed, storage: createStorageConfig(parsed) };
}

export type WorkerConfig = ReturnType<typeof createWorkerConfig>;
