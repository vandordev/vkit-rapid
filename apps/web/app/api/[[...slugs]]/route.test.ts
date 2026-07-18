import { expect, test } from "bun:test";

import { resolvedConfigEnvironment } from "../../../../../packages/config/src/run";

test("forwards the Next.js API route to the embedded Elysia app", async () => {
  Object.assign(
    process.env,
    resolvedConfigEnvironment(["base", "api", "web"], { DATABASE_URL: "postgresql://db", NODE_ENV: "test" }),
  );
  const { GET } = await import("./route");
  const response = await GET(new Request("http://localhost:4100/api/status"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { status: "ok" } });
});

test("exports all supported HTTP methods", async () => {
  Object.assign(
    process.env,
    resolvedConfigEnvironment(["base", "api", "web"], { DATABASE_URL: "postgresql://db", NODE_ENV: "test" }),
  );
  const { DELETE, OPTIONS, PATCH, POST, PUT } = await import("./route");

  expect(POST).toBeDefined();
  expect(PUT).toBeDefined();
  expect(PATCH).toBeDefined();
  expect(DELETE).toBeDefined();
  expect(OPTIONS).toBeDefined();
});
