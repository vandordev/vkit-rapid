import { expect, test } from "bun:test";

import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "./route";

test("forwards the Next.js API route to the embedded Elysia app", async () => {
  const response = await GET(new Request("http://localhost:4100/api/status"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { status: "ok" } });
});

test("exports all supported HTTP methods", () => {
  expect(POST).toBeDefined();
  expect(PUT).toBeDefined();
  expect(PATCH).toBeDefined();
  expect(DELETE).toBeDefined();
  expect(OPTIONS).toBeDefined();
});
