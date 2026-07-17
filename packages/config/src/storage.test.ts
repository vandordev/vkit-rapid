import { expect, test } from "bun:test";

import { createStorageConfig } from "./storage";

test("maps a complete optional S3 configuration", () => {
  expect(createStorageConfig({ S3_BUCKET: "uploads", S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "secret" })).toMatchObject({ bucket: "uploads", rootPrefix: "uploads" });
});

test("rejects partial storage credentials", () => {
  expect(() => createStorageConfig({ S3_BUCKET: "uploads" })).toThrow();
});
