import { describe, expect, test } from "bun:test";

import { buildAuthLoginUrl, getRequestBaseUrl } from "./sso";

describe("SSO helpers", () => {
  test("builds Oriskin login URL with sleekflow client id", () => {
    const url = new URL(buildAuthLoginUrl("https://gateway.example.test"));

    expect(url.origin).toBe("https://auth.oriskin.co.id");
    expect(url.searchParams.get("client_id")).toBe("sleekflow");
    expect(url.searchParams.get("redirect_url")).toBe("https://gateway.example.test/callback");
  });

  test("uses forwarded host and proto for request base URL", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "sleekflow.oriskin.test",
      host: "localhost:4100",
    });

    expect(getRequestBaseUrl(headers)).toBe("https://sleekflow.oriskin.test");
  });
});
