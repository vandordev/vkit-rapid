import { expect, test } from "bun:test";

import { createCommonConfig } from "./common";
import { loadConfig } from "./loader";

const configDirectory = new URL("../../../config", import.meta.url).pathname;

test("requires an explicit database URL in production", () => {
  expect(() =>
    createCommonConfig(
      loadConfig({
        configDirectory,
        modules: ["base"],
        environment: { NODE_ENV: "production" },
      }) as Record<string, string | undefined>,
    ),
  ).toThrow('Missing configuration environment variable "DATABASE_URL"');
});

test("creates common config from resolved YAML values", () => {
  expect(
    createCommonConfig(
      loadConfig({
        configDirectory,
        modules: ["base"],
        environment: { NODE_ENV: "development", DATABASE_URL: "postgresql://db" },
      }) as Record<string, string | undefined>,
    ).DATABASE_URL,
  ).toBe("postgresql://db");
});
