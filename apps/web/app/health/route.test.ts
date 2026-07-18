import { expect, test } from "bun:test";

import { resolvedConfigEnvironment } from "../../../../packages/config/src/run";

test("exposes the embedded Elysia health endpoint through Next.js", async () => {
  Object.assign(
    process.env,
    resolvedConfigEnvironment(["base", "api", "web"], { DATABASE_URL: "postgresql://db", NODE_ENV: "test" }),
  );
  const { GET } = await import("./route");
  const response = await GET(new Request("http://localhost:4100/health"));

  expect(response.status).toBe(200);
  expect((await response.json()).data.status).toBe("healthy");
});
