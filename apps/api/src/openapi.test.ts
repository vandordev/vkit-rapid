import { expect, test } from "bun:test";

import { resolvedConfigEnvironment } from "../../../packages/config/src/run";

async function getApp() {
  Object.assign(
    process.env,
    resolvedConfigEnvironment(["base", "api"], { DATABASE_URL: "postgresql://db", NODE_ENV: "test" }),
  );
  return (await import("./app")).app;
}

test("serves generated OpenAPI JSON", async () => {
  const app = await getApp();
  const response = await app.handle(new Request("http://localhost:4101/api/openapi.json"));

  expect(response.status).toBe(200);
  const document = await response.json();
  expect(document.openapi).toMatch(/^3\./);
  expect(document.servers).toEqual([{ url: "http://localhost:4101" }]);
});

test("serves Scalar documentation", async () => {
  const app = await getApp();
  const response = await app.handle(new Request("http://localhost:4101/api/docs"));

  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"url":"/api/openapi.json"');
});
