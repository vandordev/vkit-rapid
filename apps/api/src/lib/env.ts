import { createApiConfig } from "@repo/config";

export const env = createApiConfig(process.env);
export type Env = typeof env;
