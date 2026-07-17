import { expect, test } from "bun:test";

import { createWorkerConfig } from "./worker";

test("creates worker config from common server values", () => {
  expect(createWorkerConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://db" }).NODE_ENV).toBe("test");
});

test("maps optional S3 variables for workers", () => {
  expect(
    createWorkerConfig({
      S3_BUCKET: "uploads",
      S3_ACCESS_KEY_ID: "id",
      S3_SECRET_ACCESS_KEY: "secret",
    }).storage,
  ).toMatchObject({ bucket: "uploads", rootPrefix: "uploads" });
});
