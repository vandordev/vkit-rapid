import { expect, test } from "bun:test";

import { createSchedulerConfig } from "./scheduler";
import { loadConfig } from "./loader";

const configDirectory = new URL("../../../config", import.meta.url).pathname;

test("creates scheduler config from common server values", () => {
  expect(
    createSchedulerConfig(
      loadConfig({
        configDirectory,
        modules: ["base", "scheduler"],
        environment: { NODE_ENV: "test", DATABASE_URL: "postgresql://db" },
      }) as Record<string, string | undefined>,
    ).DATABASE_URL,
  ).toBe("postgresql://db");
});
