import { expect, test } from "bun:test";

import { createRealtimePublisher } from "./publisher";

const event = {
  type: "resource.updated" as const,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  resourceId: "r1",
  workspaceId: "w1",
};

test("publishes validated events with internal credentials", async () => {
  let request: Request | undefined;
  const publisher = createRealtimePublisher({
    baseUrl: "http://localhost:4102",
    apiKey: "publisher-key",
    fetch: async (input, init) => {
      request = new Request(input, init);
      return new Response(null, { status: 202 });
    },
  });

  await publisher.publish(event);

  expect(request?.url).toBe("http://localhost:4102/internal/events");
  expect(request?.headers.get("x-realtime-api-key")).toBe("publisher-key");
});

test("throws when the realtime endpoint rejects an event", async () => {
  const publisher = createRealtimePublisher({
    baseUrl: "http://localhost:4102",
    apiKey: "publisher-key",
    fetch: async () => new Response(null, { status: 500 }),
  });

  await expect(publisher.publish(event)).rejects.toThrow("Realtime publisher rejected event");
});
