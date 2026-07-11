import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { env } from "./lib/env";
import { AppError } from "./lib/errors";
import { logger } from "./lib/logger";
import { healthRoutes, statusRoutes } from "./routes";

const blockedPathPatterns: readonly RegExp[] = [
  /^\/\.env/,
  /^\/\.git/,
  /^\/\.vscode/,
  /^\/node_modules/,
  /^\/package\.json/,
  /^\/bun\.lockb/,
  /^\/bun\.lock/,
  /^\/pnpm-lock\.yaml/,
  /^\/yarn\.lock/,
  /\/\.env$/,
  /\/\.git\//,
];

export const app = new Elysia()
  .onRequest(({ request, set }) => {
    const pathname = new URL(request.url).pathname.toLowerCase();

    if (blockedPathPatterns.some((pattern) => pattern.test(pathname))) {
      set.status = 404;
      return {
        success: false,
        error: "NOT_FOUND",
        message: "Resource not found",
      };
    }
  })
  .derive(({ request, headers }) => {
    const requestId = headers["x-request-id"] || crypto.randomUUID();
    const startedAt = Date.now();

    logger.info(
      {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
      },
      `[REQUEST] ${request.method} ${new URL(request.url).pathname}`,
    );

    return { requestId, startedAt };
  })
  .onAfterHandle(({ request, set, requestId, startedAt }) => {
    set.headers["x-request-id"] = requestId;

    logger.info(
      {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status,
        duration: Date.now() - startedAt,
      },
      `[RESPONSE] ${request.method} ${new URL(request.url).pathname} ${set.status}`,
    );
  })
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-API-Key", "x-request-id"],
    }),
  )
  .onError(({ error, code, set, requestId }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return {
        success: false,
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        ...(requestId ? { requestId } : {}),
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        success: false,
        error: "NOT_FOUND",
        message: "Resource not found",
        ...(requestId ? { requestId } : {}),
      };
    }

    logger.error({ requestId, code, error }, "Unhandled API error");

    set.status = 500;
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      ...(requestId ? { requestId } : {}),
    };
  })
  .use(healthRoutes)
  .use(statusRoutes);
