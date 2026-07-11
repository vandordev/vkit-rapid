import { describe, expect, test } from "bun:test";

import { app } from "./app";

describe("external API boundary", () => {
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
