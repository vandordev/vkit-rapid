import { expect, test } from "bun:test";

import { createSchedulerConfig } from "./scheduler";

test("creates scheduler config from common server values", () => {
  expect(createSchedulerConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://db" }).DATABASE_URL).toBe("postgresql://db");
});
