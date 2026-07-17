import { z } from "zod";

export const realtimeEventSchema = z.object({
  type: z.literal("resource.updated"),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  resourceId: z.string().min(1),
  workspaceId: z.string().min(1),
});

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export function roomsForEvent(event: RealtimeEvent): string[] {
  return [`resource:${event.resourceId}`, `workspace:${event.workspaceId}`];
}
