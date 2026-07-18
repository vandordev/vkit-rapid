import { expect, test } from "bun:test";

import { createApiConfig } from "./api";
import { loadConfig } from "./loader";

const configDirectory = new URL("../../../config", import.meta.url).pathname;
const loadApiEnvironment = (environment: Record<string, string | undefined>) =>
  loadConfig({ configDirectory, modules: ["base", "api", "storage"], environment }) as Record<
    string,
    string | undefined
  >;

test("creates API config from scoped values", () => {
  expect(
    createApiConfig(loadApiEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://db",
      PORT: "4101",
      CORS_ORIGIN: "http://localhost:4100",
    })),
  ).toMatchObject({ port: 4101, corsOrigin: "http://localhost:4100" });
});

test("maps the public server URL for OpenAPI documentation", () => {
  expect(
    createApiConfig(loadApiEnvironment({ DATABASE_URL: "postgresql://db", OPENAPI_SERVER_URL: "https://api.example.com" })).openapiServerUrl,
  ).toBe("https://api.example.com");
});

test("maps optional S3 variables without exposing them to clients", () => {
  expect(
    createApiConfig(loadApiEnvironment({
      DATABASE_URL: "postgresql://db",
      S3_BUCKET: "uploads",
      S3_REGION: "ap-southeast-1",
      S3_ACCESS_KEY_ID: "id",
      S3_SECRET_ACCESS_KEY: "secret",
    })).storage,
  ).toMatchObject({ bucket: "uploads", rootPrefix: "uploads" });
});

test("requires a database URL through the base YAML module", () => {
  expect(() => createApiConfig(loadApiEnvironment({ NODE_ENV: "test" }))).toThrow(
    'Missing configuration environment variable "DATABASE_URL"',
  );
});

test("requires both documentation credentials when either is configured", () => {
  expect(() => createApiConfig(loadApiEnvironment({ DATABASE_URL: "postgresql://db", NODE_ENV: "test", OPENAPI_BASIC_AUTH_USERNAME: "docs" }))).toThrow();
});
