import { openapi } from "@elysiajs/openapi";

export const openapiPlugin = openapi({
  path: "/api/docs",
  specPath: "/api/openapi.json",
  provider: "scalar",
  scalar: { url: "/api/openapi.json" },
  documentation: {
    openapi: "3.0.3",
    info: { title: "API", version: "1.0.0", description: "Generated from Elysia route schemas." },
    tags: [{ name: "Health", description: "Process liveness and readiness" }, { name: "System", description: "Lightweight status probes" }],
  },
});
