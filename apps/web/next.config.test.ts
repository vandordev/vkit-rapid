import { describe, expect, test } from "bun:test";

import { publicConfigEnvironment } from "../../packages/config/src/run";
import nextConfig from "./next.config.mjs";

describe("Next.js route boundary", () => {
	test("does not configure a duplicate rewrite for the embedded API", () => {
		expect(nextConfig.rewrites).toBeUndefined();
	});

	test("exposes only resolved NEXT_PUBLIC values to browser code", () => {
		const resolvedWebEnvironment = publicConfigEnvironment(
			["base", "web", "api", "realtime"],
			{
				DATABASE_URL: "postgresql://db",
				REALTIME_TICKET_SECRET: "ticket-secret",
				REALTIME_PUBLISH_API_KEY: "publisher-key",
			},
		);

		expect(resolvedWebEnvironment.NEXT_PUBLIC_APP_URL).toBe("http://localhost:4100");
		expect(resolvedWebEnvironment).not.toHaveProperty("REALTIME_TICKET_SECRET");
		expect(resolvedWebEnvironment).not.toHaveProperty("DATABASE_URL");
	});

	test("selects YAML modules through the single root environment file", async () => {
		const scripts = (await Bun.file(new URL("./package.json", import.meta.url)).json()).scripts;

		expect(scripts.dev).toContain("--env-file=../../.env");
		expect(scripts.dev).toContain("--modules base,web,api,storage");
	});
});
