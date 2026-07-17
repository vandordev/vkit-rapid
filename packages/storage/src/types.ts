export type StorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  rootPrefix: string;
};

export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};
