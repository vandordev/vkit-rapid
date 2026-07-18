import { expect, test } from "bun:test";

import { createWorkerConfig } from "./worker";
import { loadConfig } from "./loader";

const configDirectory = new URL("../../../config", import.meta.url).pathname;
const loadWorkerEnvironment = (environment: Record<string, string | undefined>) =>
  loadConfig({ configDirectory, modules: ["base", "worker", "storage"], environment }) as Record<
    string,
    string | undefined
  >;

test("creates worker config from common server values", () => {
  expect(createWorkerConfig(loadWorkerEnvironment({ NODE_ENV: "test", DATABASE_URL: "postgresql://db" })).NODE_ENV).toBe("test");
});

test("maps optional S3 variables for workers", () => {
  expect(
    createWorkerConfig(loadWorkerEnvironment({
      DATABASE_URL: "postgresql://db",
      S3_BUCKET: "uploads",
      S3_ACCESS_KEY_ID: "id",
      S3_SECRET_ACCESS_KEY: "secret",
    })).storage,
  ).toMatchObject({ bucket: "uploads", rootPrefix: "uploads" });
});
