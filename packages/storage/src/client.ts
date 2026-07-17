import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { assertObjectKey } from "./keys";
import type { PutObjectInput, StorageConfig } from "./types";

type S3ClientLike = {
  send(command: PutObjectCommand | GetObjectCommand): Promise<unknown>;
};

export function createStorageClient(
  config: StorageConfig,
  client: S3ClientLike = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  }),
) {
  return {
    async put(input: PutObjectInput) {
      assertObjectKey(config.rootPrefix, input.key);
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },
    async get(key: string) {
      assertObjectKey(config.rootPrefix, key);
      return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
