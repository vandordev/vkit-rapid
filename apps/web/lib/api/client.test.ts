import { expect, test } from "bun:test";

test("builds an Eden treaty client from the configured URL", async () => {
  process.env.DATABASE_URL = "postgresql://localhost:5432/test";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4100";
  const { createApiClient } = await import("./client");

  expect(createApiClient("http://localhost:4101")).toBeDefined();
});
