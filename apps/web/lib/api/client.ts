import { treaty } from "@elysia/eden";

import type { App } from "@repo/api";

import { env } from "../env";

type ApiClient = ReturnType<typeof treaty<App>>;

export function createApiClient(baseUrl: string): ApiClient {
  return treaty<App>(baseUrl);
}

export const api: ApiClient = createApiClient(
  typeof window === "undefined"
    ? (env.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL)
    : env.NEXT_PUBLIC_API_URL,
);
