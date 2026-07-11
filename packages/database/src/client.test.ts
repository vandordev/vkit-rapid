import { expect, test } from "bun:test";

import { prisma } from "./client";

test("exports one Prisma client", () => {
  expect(prisma).toBeDefined();
  expect(typeof prisma.$connect).toBe("function");
});
