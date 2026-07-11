import { env } from "@api/lib/env";
import { app } from "./app";

app.listen(env.PORT);

console.log(`
Oriskin external API boundary
Local:        http://localhost:${env.PORT}
Environment:  ${env.NODE_ENV}
Health:       http://localhost:${env.PORT}/health
`);

export type Server = typeof app;
