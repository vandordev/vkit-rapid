import { expect, test } from "bun:test";

test("builds an Eden treaty client from the configured URL", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4101";
  const { createApiClient } = await import("./client");

  expect(createApiClient("http://localhost:4101")).toBeDefined();
});
