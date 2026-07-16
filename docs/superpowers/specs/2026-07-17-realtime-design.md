# Optional Realtime Blueprint Design

## Goal

Provide a secure, opt-in realtime runtime for products that need live dashboard updates without changing the default web/API deployment.

## Scope

- Add `@repo/realtime` for versioned, Zod-validated event envelopes, room-name helpers, ticket signing, and internal event publishing.
- Add `apps/realtime`, a Socket.IO runtime that authenticates short-lived tickets and authorizes every room join through injected dependencies.
- Add distinct realtime configuration, environment example, Taskfile commands, Dockerfile, and Compose profile.
- Document reconnect behavior: events notify clients to refresh typed HTTP read models rather than acting as the authoritative data source.

## Design

The API and worker publish validated events to the realtime service's authenticated internal endpoint only after the originating database transaction completes. The realtime service validates each event and emits it exclusively to rooms selected by its event contract. Browser clients first fetch a short-lived ticket from an authenticated API endpoint, then connect using that ticket; the realtime process independently verifies its signature and claims.

Room membership is never inferred from a client-provided identifier. The realtime server calls product-supplied authorization functions for every requested conversation, tenant, or workspace room. Initial operation is single-instance. Multi-instance operation is explicitly deferred until a Socket.IO Redis adapter and its operational configuration are introduced.

`apps/realtime` is absent from the default `task dev`, default Compose stack, and required web environment. Projects enable it through dedicated realtime commands and environment files.

## Non-goals

- Enabling Socket.IO for all projects.
- Replacing Eden/HTTP reads with socket state replication.
- Cross-instance fan-out without a configured adapter.
- A product-specific event taxonomy or authorization query.

## Verification

- Contract tests reject malformed events and invalid/expired tickets.
- Server tests reject unauthenticated publishers and unauthorized room joins, and confirm valid events reach the correct rooms.
- Client tests confirm reconnect triggers a typed HTTP resync.
