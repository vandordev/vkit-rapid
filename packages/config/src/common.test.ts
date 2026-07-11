import { expect, test } from "bun:test";

import { createCommonConfig } from "./common";

test("requires an explicit database URL in production", () => {
  expect(() => createCommonConfig({ NODE_ENV: "production" })).toThrow();
});

test("allows the local database default outside production", () => {
  expect(createCommonConfig({ NODE_ENV: "development" }).DATABASE_URL).toBe(
    "postgresql://localhost:5432/postgres",
  );
});
