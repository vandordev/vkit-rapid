import { expect, test } from "bun:test";

import { createWorkerConfig } from "./worker";

test("creates worker config from common server values", () => {
  expect(createWorkerConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://db" }).NODE_ENV).toBe("test");
});
