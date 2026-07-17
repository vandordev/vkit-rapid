import { expect, test } from "bun:test";

import { createRealtimeConfig } from "./realtime";

test("creates a scoped realtime runtime configuration", () => {
  expect(
    createRealtimeConfig({
      REALTIME_TICKET_SECRET: "ticket-secret",
      REALTIME_PUBLISH_API_KEY: "publisher-key",
    }),
  ).toMatchObject({ port: 4102 });
});
