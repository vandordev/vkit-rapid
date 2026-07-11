import { treaty } from "@elysia/eden";

import type { App } from "@repo/api";

import { env } from "../env";

type ApiClient = ReturnType<typeof treaty<App>>["api"];

export function createApiClient(baseUrl: string): ApiClient {
  return treaty<App>(baseUrl).api;
}

export const api: ApiClient = createApiClient(
  env.NEXT_PUBLIC_APP_URL,
);
