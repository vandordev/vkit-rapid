import { expect, test } from "bun:test";

import { resolvedConfigEnvironment } from "../../../../packages/config/src/run";

test("builds an Eden treaty client from the configured URL", async () => {
  Object.assign(
    process.env,
    resolvedConfigEnvironment(["base", "web", "api"], { DATABASE_URL: "postgresql://localhost:5432/test" }),
  );
  const { createApiClient } = await import("./client");

  expect(createApiClient(process.env.NEXT_PUBLIC_APP_URL!)).toBeDefined();
});
