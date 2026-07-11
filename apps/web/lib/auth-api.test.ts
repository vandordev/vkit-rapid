import { describe, expect, test } from "bun:test";

import { extractTokenData } from "./auth-api";

describe("auth api helpers", () => {
  test("extracts direct token data", () => {
    const tokenData = extractTokenData({
      data: {
        access_token: "access",
        refresh_token: "refresh",
      },
    });

    expect(tokenData?.access_token).toBe("access");
    expect(tokenData?.refresh_token).toBe("refresh");
  });

  test("extracts nested token data", () => {
    const tokenData = extractTokenData({
      data: {
        data: {
          access_token: "access",
          refresh_token: "refresh",
        },
      },
    });

    expect(tokenData?.access_token).toBe("access");
    expect(tokenData?.refresh_token).toBe("refresh");
  });
});
