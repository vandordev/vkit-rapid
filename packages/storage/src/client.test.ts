import { expect, test } from "bun:test";

import { createStorageClient } from "./client";

const config = {
  bucket: "uploads",
  region: "ap-southeast-1",
  accessKeyId: "id",
  secretAccessKey: "secret",
  rootPrefix: "product-a",
};

test("uploads a private object below the configured root", async () => {
  const commands: unknown[] = [];
  const storage = createStorageClient(config, {
    send: async (command: unknown) => {
      commands.push(command);
      return {};
    },
  });

  await storage.put({
    key: "product-a/uploads/file.pdf",
    body: new Uint8Array([1]),
    contentType: "application/pdf",
  });

  expect(commands).toHaveLength(1);
});

test("rejects writes outside the configured root", async () => {
  const storage = createStorageClient(config, { send: async () => ({}) });

  await expect(
    storage.put({
      key: "other/file.pdf",
      body: new Uint8Array([1]),
      contentType: "application/pdf",
    }),
  ).rejects.toThrow("outside configured prefix");
});
