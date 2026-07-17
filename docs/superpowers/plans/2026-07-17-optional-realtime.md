# Optional Realtime Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separately runnable, authenticated Socket.IO realtime blueprint with validated events and authorized rooms.

**Architecture:** `@repo/realtime` contains event, ticket, and publisher contracts. `apps/realtime` owns Socket.IO, internal event ingestion, ticket verification, and injected product authorization; it is excluded from default dev and Compose paths.

**Tech Stack:** Socket.IO, TypeScript, Zod, Node HTTP, HMAC SHA-256, Bun test, Docker Compose profiles.

---

## File structure

- Create: `packages/realtime/{package.json,tsconfig.json,eslint.config.js,src/events.ts,src/ticket.ts,src/publisher.ts,src/index.ts}` and contract tests.
- Create: `apps/realtime/{package.json,tsconfig.json,eslint.config.js,src/main.ts,src/server.ts,src/auth.ts}` and server tests.
- Create: `.env.realtime.example`, `Dockerfile.realtime`.
- Modify: root `package.json`, `Taskfile.yml`, `docker-compose.yml`, `.gitignore`, `README.md`, `.agent/architecture.md`, `.agent/config.md`.

### Task 1: Define and test the shared realtime contract

**Files:** `packages/realtime/src/{events,ticket,publisher,index}.ts`, `packages/realtime/src/{events,ticket,publisher}.test.ts`.

- [ ] **Step 1: Write failing event and ticket tests**

```ts
test("routes a resource event to resource and workspace rooms", () => {
  const event = realtimeEventSchema.parse({ type: "resource.updated", eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), resourceId: "r1", workspaceId: "w1" });
  expect(roomsForEvent(event)).toEqual(["resource:r1", "workspace:w1"]);
});
test("rejects an expired ticket", () => {
  expect(() => verifyRealtimeTicket(expiredTicket, secret)).toThrow("Expired realtime ticket");
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test packages/realtime`  
Expected: FAIL because the package has not been created.

- [ ] **Step 3: Implement contracts**

```ts
export const realtimeEventSchema = z.object({ type: z.literal("resource.updated"), eventId: z.string().uuid(), occurredAt: z.string().datetime(), resourceId: z.string(), workspaceId: z.string() });
export const roomsForEvent = (event: RealtimeEvent) => [`resource:${event.resourceId}`, `workspace:${event.workspaceId}`];
export const signRealtimeTicket = (claims: RealtimeClaims, secret: string) => `${base64url(JSON.stringify(claims))}.${createHmac("sha256", secret).update(base64url(JSON.stringify(claims))).digest("base64url")}`;
```

Implement `createRealtimePublisher` to validate before POSTing JSON with `x-realtime-api-key` to `/internal/events`, and throw for a non-2xx response.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk bun test packages/realtime`  
Expected: PASS.

```bash
git add packages/realtime package.json bun.lock
git commit -m "feat(realtime): add validated event contracts"
```

### Task 2: Build the optional realtime runtime

**Files:** `apps/realtime/src/{server,auth,main}.ts`, `apps/realtime/src/{server,auth}.test.ts`, app manifests.

- [ ] **Step 1: Write failing server behavior tests**

```ts
test("rejects an internal event without publisher credentials", async () => {
  const response = await fetch(url("/internal/events"), { method: "POST", body: "{}" });
  expect(response.status).toBe(401);
});
test("does not join an unauthorized workspace", async () => {
  const result = await client.emitWithAck("join-workspace", "w1");
  expect(result).toEqual({ ok: false });
});
```

- [ ] **Step 2: Run RED**

Run: `rtk bun test apps/realtime`  
Expected: FAIL because `createRealtimeServer` does not exist.

- [ ] **Step 3: Implement the isolated server factory**

```ts
export function createRealtimeServer(dependencies: Dependencies) {
  const httpServer = createServer(/* health and authenticated event endpoint */);
  const io = new Server(httpServer, { path: "/ws", addTrailingSlash: false });
  io.use(async (socket, next) => { try { socket.data.subject = await dependencies.authenticate(String(socket.handshake.auth.ticket)); next(); } catch { next(new Error("unauthorized")); } });
  io.on("connection", (socket) => socket.on("join-workspace", async (workspaceId, callback) => {
    const ok = typeof workspaceId === "string" && await dependencies.authorizeWorkspace(socket.data.subject.id, workspaceId);
    if (ok) socket.join(`workspace:${workspaceId}`);
    callback?.({ ok });
  }));
  return { httpServer, io, listen, close };
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk bun test apps/realtime && rtk turbo run check-types --filter=@repo/realtime-server`  
Expected: both commands exit `0`.

```bash
git add apps/realtime packages/realtime bun.lock
git commit -m "feat(realtime): add optional Socket.IO runtime"
```

### Task 3: Wire opt-in commands and operational docs

**Files:** `.env.realtime.example`, `Dockerfile.realtime`, `package.json`, `Taskfile.yml`, `docker-compose.yml`, `.gitignore`, `README.md`, `.agent/{architecture,config}.md`.

- [ ] **Step 1: Add explicit scripts and task**

```json
"dev:realtime": "turbo run dev --filter=@repo/realtime-server",
"start:realtime": "cd apps/realtime && bun run start"
```

```yaml
dev:realtime:
  desc: Run the optional realtime runtime
  cmds: [rtk bun run dev:realtime]
```

- [ ] **Step 2: Add isolated environment and Compose profile**

```env
REALTIME_PORT=4102
REALTIME_TICKET_SECRET=
REALTIME_PUBLISH_API_KEY=
```

```yaml
realtime:
  profiles: ["realtime"]
  build: { context: ., dockerfile: Dockerfile.realtime }
  env_file: [.env.realtime]
```

- [ ] **Step 3: Document runtime invariants**

```md
The realtime process is optional and single-instance by default. Publish only after the database transaction commits. Clients treat events and reconnects as signals to refetch Eden-backed read models. Multi-instance deployment requires an explicit Socket.IO adapter.
```

- [ ] **Step 4: Verify and commit**

Run: `rtk bun test packages/realtime apps/realtime && rtk turbo run check-types --filter=@repo/realtime --filter=@repo/realtime-server`  
Expected: all commands exit `0`.

```bash
git add .env.realtime.example Dockerfile.realtime package.json Taskfile.yml docker-compose.yml .gitignore README.md .agent/architecture.md .agent/config.md
git commit -m "docs: describe optional realtime runtime"
```

