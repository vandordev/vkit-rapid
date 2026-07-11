import { describe, expect, test } from "bun:test";

import { requireAuthWithDependencies } from "./require-auth";

describe("requireAuth", () => {
  test("returns the current access token when the user is authenticated", async () => {
    const token = await requireAuthWithDependencies({
      authServer: async () => "access-token",
      headers: async () => new Headers(),
      redirect: () => {
        throw new Error("redirect should not be called");
      },
    });

    expect(token).toBe("access-token");
  });

  test("redirects to SSO login with the forwarded request base URL when unauthenticated", async () => {
    let redirectUrl = "";

    await expect(
      requireAuthWithDependencies({
        authServer: async () => null,
        headers: async () =>
          new Headers({
            "x-forwarded-proto": "https",
            "x-forwarded-host": "sleekflow.oriskin.co.id",
          }),
        redirect: (url) => {
          redirectUrl = url;
          throw new Error("NEXT_REDIRECT");
        },
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectUrl).toBe(
      "https://auth.oriskin.co.id/?client_id=sleekflow&redirect_url=https%3A%2F%2Fsleekflow.oriskin.co.id%2Fcallback",
    );
  });
});
