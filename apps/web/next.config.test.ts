import { describe, expect, test } from "bun:test";

import nextConfig from "./next.config.mjs";

describe("Next.js route boundary", () => {
	test("does not configure a duplicate rewrite for the embedded API", () => {
		expect(nextConfig.rewrites).toBeUndefined();
	});
});
