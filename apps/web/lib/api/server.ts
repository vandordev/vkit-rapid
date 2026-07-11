import "server-only";

import { treaty } from "@elysia/eden";
import { app } from "@repo/api";
import type { App } from "@repo/api";

type ServerApi = ReturnType<typeof treaty<App>>["api"];

export const api: ServerApi = treaty<App>(app).api;
