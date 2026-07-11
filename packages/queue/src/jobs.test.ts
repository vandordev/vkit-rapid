import { expect, test } from "bun:test";

import { jobNames } from "./jobs";

test("starts with no product-domain job names", () => {
  expect(jobNames).toEqual([]);
});
