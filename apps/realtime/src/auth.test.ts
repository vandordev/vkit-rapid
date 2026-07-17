import { expect, test } from "bun:test";

import { createTicketAuthenticator } from "./auth";

test("maps verified ticket claims to a realtime subject", async () => {
  const authenticate = createTicketAuthenticator("secret");

  await expect(authenticate("bad-ticket")).rejects.toThrow("Invalid realtime ticket");
});
