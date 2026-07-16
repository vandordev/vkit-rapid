# Generated OpenAPI Design

## Goal

Make the Elysia HTTP contract discoverable to external consumers without maintaining a second, static API specification.

## Scope

- Add generated OpenAPI 3 documentation from existing Elysia schemas.
- Serve Scalar at `/api/docs` and the specification at `/api/openapi.json`.
- Support optional HTTP Basic authentication for both documentation endpoints.
- Document route metadata through Elysia route definitions, including summaries, tags, and security requirements.

## Design

`apps/api/src/openapi.ts` owns the `@elysiajs/openapi` configuration and is registered once by `apps/api/src/app.ts`. The Elysia app remains the sole source of transport contracts; handlers continue to declare request and response schemas.

Documentation authentication is enforced in the API request boundary before the OpenAPI plugin responds. When both documentation credentials are absent, the documentation endpoints are public for local development. When either value is configured, both values are required and a request must present valid Basic credentials. Invalid or absent credentials receive `401` and `WWW-Authenticate`.

## Non-goals

- A handwritten OpenAPI file.
- Authentication or authorization for business endpoints.
- Product-specific tags, server URLs, or security schemes.

## Verification

- Unit tests cover public docs by default, valid credentials, invalid credentials, and a generated OpenAPI version field.
- API tests confirm the plugin composes with the existing error envelope and embedded Next.js adapter.
