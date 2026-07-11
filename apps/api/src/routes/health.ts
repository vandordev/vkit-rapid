import { Elysia, t } from "elysia";

import { prisma } from "@repo/database";

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
    async ({ set }) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return {
          success: true as const,
          data: {
            status: "ready" as const,
            timestamp: new Date().toISOString(),
          },
        };
      } catch {
        set.status = 503;
        return {
          success: false as const,
          error: "NOT_READY" as const,
          message: "Database is not ready",
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          data: t.Object({
            status: t.Literal("ready"),
            timestamp: t.String(),
          }),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.Literal("NOT_READY"),
          message: t.String(),
          timestamp: t.String(),
        }),
      ]),
    },
  );
