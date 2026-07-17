# OpenAPI Server URL Design

## Goal

Expose the deployed API base URL in the generated OpenAPI document used by Scalar.

## Design

`OPENAPI_SERVER_URL` is a server-only API configuration value. It is a validated absolute URL with a local standalone-API default of `http://localhost:4101`.

The Elysia OpenAPI plugin receives that value and emits it through `documentation.servers`. Scalar continues to load `/api/openapi.json` relatively, so the docs UI stays compatible with both standalone and embedded API deployments.

The API and web environment examples both document the value. In an embedded deployment, `.env.web` supplies the externally visible API origin because Elysia runs through the Next.js route handler.

## Testing

Configuration tests cover parsing the new value. OpenAPI integration tests assert that the generated document includes the configured server URL.
