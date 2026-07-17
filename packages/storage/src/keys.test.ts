import { expect, test } from "bun:test";

import { assertObjectKey, buildObjectKey } from "./keys";

test("builds an object key below its product prefix", () => {
  expect(buildObjectKey({ rootPrefix: "product-a", fileName: "résumé.pdf" })).toMatch(/^product-a\/uploads\//);
});

test("rejects a key outside its product prefix", () => {
  expect(() => assertObjectKey("product-a", "other/file.pdf")).toThrow("outside configured prefix");
});
