import { expect, test } from "bun:test";

import { app } from "./app";

test("serves generated OpenAPI JSON", async () => {
  const response = await app.handle(new Request("http://localhost:4101/api/openapi.json"));

  expect(response.status).toBe(200);
  expect((await response.json()).openapi).toMatch(/^3\./);
});

test("serves Scalar documentation", async () => {
  const response = await app.handle(new Request("http://localhost:4101/api/docs"));

  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"url":"/api/openapi.json"');
});
