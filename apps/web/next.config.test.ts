import { describe, expect, test } from "bun:test";

import nextConfig from "./next.config.mjs";

describe("Next.js route boundary", () => {
	test("does not proxy the internal /api namespace to Elysia", () => {
		expect(nextConfig.rewrites).toBeUndefined();
	});
});
