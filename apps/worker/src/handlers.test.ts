import { expect, test } from "bun:test";

import { registerHandlers } from "./handlers";

test("registers no domain handlers in the generic baseline", async () => {
  const registered: string[] = [];
  await registerHandlers({ work: async (name: string) => { registered.push(name); } } as never);
  expect(registered).toEqual([]);
});
