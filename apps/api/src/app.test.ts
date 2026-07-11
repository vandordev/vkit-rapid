import { describe, expect, test } from "bun:test";

import { app } from "./app";

describe("external API boundary", () => {
	test("serves the API status contract under /api", async () => {
		const response = await app.handle(new Request("http://localhost:4101/api/status"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, data: { status: "ok" } });
	});

	test("uses the API failure envelope", async () => {
		const response = await app.handle(new Request("http://localhost:4101/api/missing"));

		expect(await response.json()).toMatchObject({ success: false, error: "NOT_FOUND" });
	});

	test("serves health", async () => {
		const response = await app.handle(new Request("http://localhost:4101/health"));

		expect(response.status).toBe(200);
		expect((await response.json()).data.status).toBe("healthy");
	});

	test("does not expose retired gateway routes", async () => {
		const response = await app.handle(new Request("http://localhost:4101/api/messages"));

		expect(response.status).toBe(404);
	});
});
