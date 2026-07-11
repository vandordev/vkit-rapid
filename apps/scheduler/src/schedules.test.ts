import { expect, test } from "bun:test";

import { registerSchedules } from "./schedules";

test("registers no product schedules in the generic baseline", async () => {
  const scheduled: string[] = [];
  await registerSchedules({ schedule: async (name: string) => { scheduled.push(name); } } as never);
  expect(scheduled).toEqual([]);
});
