import { expect, test } from "bun:test";

import { GET } from "./route";

test("exposes the embedded Elysia health endpoint through Next.js", async () => {
  const response = await GET(new Request("http://localhost:4100/health"));

  expect(response.status).toBe(200);
  expect((await response.json()).data.status).toBe("healthy");
});
