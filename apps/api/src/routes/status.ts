import { Elysia, t } from "elysia";

export const statusRoutes = new Elysia({ prefix: "/api", tags: ["System"] }).get(
  "/status",
  () => ({ success: true as const, data: { status: "ok" as const } }),
  {
    response: t.Object({
      success: t.Literal(true),
      data: t.Object({ status: t.Literal("ok") }),
    }),
  },
);
