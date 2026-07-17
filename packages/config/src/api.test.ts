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

test("maps optional S3 variables without exposing them to clients", () => {
  expect(
    createApiConfig({
      DATABASE_URL: "postgresql://db",
      S3_BUCKET: "uploads",
      S3_REGION: "ap-southeast-1",
      S3_ACCESS_KEY_ID: "id",
      S3_SECRET_ACCESS_KEY: "secret",
    }).storage,
  ).toMatchObject({ bucket: "uploads", rootPrefix: "uploads" });
});

test("uses the local PostgreSQL default when DATABASE_URL is omitted", () => {
  expect(
    createApiConfig({ NODE_ENV: "test", PORT: "4101", CORS_ORIGIN: "http://localhost:4100" }).DATABASE_URL,
  ).toBe("postgresql://localhost:5432/postgres");
});

test("requires both documentation credentials when either is configured", () => {
  expect(() => createApiConfig({ NODE_ENV: "test", OPENAPI_BASIC_AUTH_USERNAME: "docs" })).toThrow();
});
