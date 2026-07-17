import { z } from "zod";

export const storageServer = {
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ROOT_PREFIX: z.string().min(1).default("uploads"),
} as const;

const schema = z.object(storageServer);

export function createStorageConfig(runtimeEnv: Record<string, unknown>) {
  const parsed = schema.parse(runtimeEnv);
  const configured = [parsed.S3_BUCKET, parsed.S3_ACCESS_KEY_ID, parsed.S3_SECRET_ACCESS_KEY];
  if (!configured.some(Boolean)) return null;
  if (!configured.every(Boolean)) throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be configured together");
  return {
    bucket: parsed.S3_BUCKET!,
    region: parsed.S3_REGION,
    accessKeyId: parsed.S3_ACCESS_KEY_ID!,
    secretAccessKey: parsed.S3_SECRET_ACCESS_KEY!,
    endpoint: parsed.S3_ENDPOINT,
    rootPrefix: parsed.S3_ROOT_PREFIX,
  };
}
