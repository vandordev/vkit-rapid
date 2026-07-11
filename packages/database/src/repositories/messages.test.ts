import { describe, expect, test } from "bun:test";

import { buildContactIdentity } from "./messages";

describe("buildContactIdentity", () => {
  test("uses phone number for WhatsApp contacts", () => {
    expect(
      buildContactIdentity({
        channel: "whatsappcloudapi",
        phone: "628123",
        externalContactId: undefined,
        channelIdentityId: "wa-channel",
        conversationId: "conv-1",
      }),
    ).toEqual({
      primaryIdentifier: "phone:628123",
      lookupValue: "628123",
    });
  });

  test("uses external contact id for Instagram when phone is missing", () => {
    expect(
      buildContactIdentity({
        channel: "instagram",
        phone: undefined,
        externalContactId: "ig-user-1",
        channelIdentityId: "ig-channel",
        conversationId: "conv-2",
      }),
    ).toEqual({
      primaryIdentifier: "external:ig-user-1",
      lookupValue: "ig-user-1",
    });
  });

  test("falls back to channel id then conversation id", () => {
    expect(
      buildContactIdentity({
        channel: "instagram",
        phone: undefined,
        externalContactId: undefined,
        channelIdentityId: "ig-channel",
        conversationId: "conv-3",
      }).primaryIdentifier,
    ).toBe("channel:ig-channel");
  });
});
