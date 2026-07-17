import { expect, test } from "bun:test";

import { isDocumentationAuthorized } from "./docs-auth";

test("allows documentation when credentials are not configured", () => {
  expect(isDocumentationAuthorized(undefined)).toBe(true);
});

test("accepts matching Basic credentials", () => {
  expect(isDocumentationAuthorized(`Basic ${Buffer.from("docs:secret").toString("base64")}`, "docs", "secret")).toBe(true);
});

test("rejects invalid Basic credentials", () => {
  expect(isDocumentationAuthorized(`Basic ${Buffer.from("docs:wrong").toString("base64")}`, "docs", "secret")).toBe(false);
});
