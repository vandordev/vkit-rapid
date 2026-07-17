import { createServer } from "node:http";

import { realtimeEventSchema, roomsForEvent } from "@repo/realtime";
import { Server } from "socket.io";

import type { RealtimeSubject } from "./auth";

type Dependencies = {
  publishApiKey: string;
  authenticate(ticket: string): Promise<RealtimeSubject>;
  authorizeWorkspace(subjectId: string, workspaceId: string): Promise<boolean>;
};

function readRequestBody(request: AsyncIterable<Uint8Array | string>): Promise<string> {
  return (async () => {
    let body = "";
    for await (const chunk of request) body += chunk;
    return body;
  })();
}

export function createRealtimeServer(dependencies: Dependencies) {
  const httpServer = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ success: true }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/internal/events") {
      response.writeHead(404).end();
      return;
    }
    if (request.headers["x-realtime-api-key"] !== dependencies.publishApiKey) {
      response.writeHead(401).end();
      return;
    }

    try {
      const event = realtimeEventSchema.parse(JSON.parse(await readRequestBody(request)));
      for (const room of roomsForEvent(event)) io.to(room).emit("realtime-event", event);
      response.writeHead(202).end();
    } catch {
      response.writeHead(400).end();
    }
  });
  const io = new Server(httpServer, { path: "/ws", addTrailingSlash: false });

  io.use(async (socket, next) => {
    try {
      socket.data.subject = await dependencies.authenticate(String(socket.handshake.auth.ticket));
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-workspace", async (workspaceId: unknown, callback?: (result: { ok: boolean }) => void) => {
      const subject = socket.data.subject as RealtimeSubject;
      const ok =
        typeof workspaceId === "string" &&
        (await dependencies.authorizeWorkspace(subject.id, workspaceId));
      if (ok) await socket.join(`workspace:${workspaceId}`);
      callback?.({ ok });
    });
  });

  return {
    httpServer,
    io,
    listen(port: number, host = "127.0.0.1"): Promise<number> {
      return new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, host, () => {
          httpServer.off("error", reject);
          const address = httpServer.address();
          if (!address || typeof address === "string") return reject(new Error("Realtime server has no TCP port"));
          resolve(address.port);
        });
      });
    },
    async close(): Promise<void> {
      io.disconnectSockets(true);
      io.engine.close();
      if (httpServer.listening) httpServer.close();
    },
  };
}
