import { expect, test } from "bun:test";

import { createApiConfig } from "./api";

test("creates API config from scoped values", () => {
  expect(
    createApiConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://db",
      PORT: "4101",
      CORS_ORIGIN: "http://localhost:4100",
    }),
  ).toMatchObject({ port: 4101, corsOrigin: "http://localhost:4100" });
});

test("rejects an API config with an empty DATABASE_URL", () => {
  expect(() =>
    createApiConfig({
      NODE_ENV: "test",
      DATABASE_URL: "",
      PORT: "4101",
      CORS_ORIGIN: "http://localhost:4100",
    }),
  ).toThrow();
});
