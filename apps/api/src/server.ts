import { env } from "./lib/env";
import { app } from "./app";

app.listen(env.port);

console.log(`
Reusable Elysia API boundary
Local:        http://localhost:${env.port}
Environment:  ${env.NODE_ENV}
Health:       http://localhost:${env.port}/health
`);

export type Server = typeof app;
