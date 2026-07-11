import { Elysia, t } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/health", tags: ["Health"] })
  .get(
    "/",
    () => ({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    }),
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Object({
          status: t.String(),
          timestamp: t.String(),
          uptime: t.Number(),
        }),
      }),
    },
  )
  .get(
    "/ready",
    () => ({
      success: true,
      data: {
        status: "ready",
        timestamp: new Date().toISOString(),
      },
    }),
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Object({
          status: t.String(),
          timestamp: t.String(),
        }),
      }),
    },
  );
