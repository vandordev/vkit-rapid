import { describe, expect, test } from "bun:test";

import { resolvedConfigEnvironment } from "../../../packages/config/src/run";

async function getApp() {
	Object.assign(
		process.env,
		resolvedConfigEnvironment(["base", "api"], { DATABASE_URL: "postgresql://db", NODE_ENV: "test" }),
	);
	return (await import("./app")).app;
}

	describe("external API boundary", () => {
	test("serves the API status contract under /api", async () => {
		const app = await getApp();
		const response = await app.handle(new Request("http://localhost:4101/api/status"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, data: { status: "ok" } });
	});

	test("uses the API failure envelope", async () => {
		const app = await getApp();
		const response = await app.handle(new Request("http://localhost:4101/api/missing"));

		expect(await response.json()).toMatchObject({ success: false, error: "NOT_FOUND" });
	});

	test("serves health", async () => {
		const app = await getApp();
		const response = await app.handle(new Request("http://localhost:4101/health"));

		expect(response.status).toBe(200);
		expect((await response.json()).data.status).toBe("healthy");
	});

	test("does not expose retired gateway routes", async () => {
		const app = await getApp();
		const response = await app.handle(new Request("http://localhost:4101/api/messages"));

		expect(response.status).toBe(404);
	});
});
