import { expect, test } from "bun:test";

import { realtimeEventSchema, roomsForEvent } from "./events";

test("routes a resource event to resource and workspace rooms", () => {
  const event = realtimeEventSchema.parse({
    type: "resource.updated",
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    resourceId: "r1",
    workspaceId: "w1",
  });

  expect(roomsForEvent(event)).toEqual(["resource:r1", "workspace:w1"]);
});
