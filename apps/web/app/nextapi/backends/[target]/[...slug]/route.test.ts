import { afterEach, describe, expect, test } from "bun:test";

import { POST } from "./route";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.BACKEND_URL_MAP;
  delete process.env.AUTH_URL;
  delete process.env.NEXT_PUBLIC_AUTH_URL;
});

describe("backend proxy route", () => {
  test("proxies auth token exchange requests to the configured auth backend", async () => {
    process.env.BACKEND_URL_MAP = "auth=https://auth.oriskin.co.id";
    let proxiedUrl = "";
    let proxiedBody = "";

    globalThis.fetch = (async (url, init) => {
      proxiedUrl = String(url);
      proxiedBody = String(init?.body);
      return new Response(JSON.stringify({ data: { access_token: "access", refresh_token: "refresh" } }), {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "84" },
      });
    }) as typeof fetch;

    const req = {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
        host: "sleekflow.oriskin.co.id",
      }),
      nextUrl: new URL("https://sleekflow.oriskin.co.id/nextapi/backends/auth/api/sso/token"),
      text: async () => JSON.stringify({ code: "test-code" }),
    };

    const response = await POST(req as never, {
      params: Promise.resolve({ target: "auth", slug: ["api", "sso", "token"] }),
    });

    expect(response.status).toBe(200);
    expect(proxiedUrl).toBe("https://auth.oriskin.co.id/api/sso/token");
    expect(proxiedBody).toBe(JSON.stringify({ code: "test-code" }));
    expect(response.headers.has("content-length")).toBe(false);
  });
});
