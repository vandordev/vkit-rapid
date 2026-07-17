import { realtimeEventSchema } from "./events";
import type { RealtimeEvent } from "./events";

type PublisherConfig = {
  baseUrl: string;
  apiKey: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export function createRealtimePublisher(config: PublisherConfig) {
  const request = config.fetch ?? globalThis.fetch;

  return {
    async publish(event: RealtimeEvent): Promise<void> {
      const response = await request(new URL("/internal/events", config.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-realtime-api-key": config.apiKey,
        },
        body: JSON.stringify(realtimeEventSchema.parse(event)),
      });
      if (!response.ok) throw new Error("Realtime publisher rejected event");
    },
  };
}
