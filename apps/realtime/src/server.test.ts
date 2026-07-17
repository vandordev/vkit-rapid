import { afterEach, expect, test } from "bun:test";
import { io } from "socket.io-client";

import { createRealtimeServer } from "./server";

const runtimes: ReturnType<typeof createRealtimeServer>[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

function createRuntime(authorizeWorkspace = async () => false) {
  const runtime = createRealtimeServer({
    publishApiKey: "publisher-key",
    authenticate: async () => ({ id: "user-1" }),
    authorizeWorkspace,
  });
  runtimes.push(runtime);
  return runtime;
}

test("rejects an internal event without publisher credentials", async () => {
  const runtime = createRuntime();
  const port = await runtime.listen(0);

  const response = await fetch(`http://127.0.0.1:${port}/internal/events`, {
    method: "POST",
    body: "{}",
  });

  expect(response.status).toBe(401);
});

test("does not join an unauthorized workspace", async () => {
  const runtime = createRuntime();
  const port = await runtime.listen(0);
  const client = io(`http://127.0.0.1:${port}`, {
    path: "/ws",
    auth: { ticket: "ticket" },
    transports: ["websocket"],
  });

  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  const result = await client.emitWithAck("join-workspace", "w1");
  await new Promise<void>((resolve) => {
    client.once("disconnect", () => resolve());
    client.close();
  });

  expect(result).toEqual({ ok: false });
});
