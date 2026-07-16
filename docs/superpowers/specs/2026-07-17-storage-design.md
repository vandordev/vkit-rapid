# Optional Object Storage Design

## Goal

Offer a reusable S3/MinIO client for server-side object storage while keeping credentials, key ownership, and object visibility product-scoped.

## Scope

- Add optional `@repo/storage` with an S3-compatible client.
- Add typed storage configuration that server runtimes can compose only when they need it.
- Provide safe object-key normalization, upload limits, MIME allow-list hooks, upload, and download operations.
- Support private objects by default; public URL generation is opt-in only when a public base URL is configured.

## Design

The storage package receives a fully validated `StorageConfig`; it does not read environment variables. `@repo/config` exposes reusable storage schema fragments and maps them into runtime configuration. API and worker runtimes opt in by composing those fragments. Web browser code never imports the package or receives storage credentials.

Each calling product supplies its own root prefix, key layout, allowed MIME types, and maximum object size. The package sanitizes client-supplied file-name segments and rejects keys outside the configured prefix. Uploads use `PutObject`; downloads use `GetObject`. No ACL is set by default, and a product that needs direct browser uploads or URLs must explicitly add a product-level presigning/public-delivery policy.

## Non-goals

- A domain attachment model or upload endpoint.
- A mandatory S3 service, environment file, or Compose dependency.
- Public-read ACLs, a shared `omni/` prefix, or provider-specific CDN setup.

## Verification

- Unit tests cover key normalization, traversal rejection, file-name sanitization, MIME/size validation, and S3 command inputs via an injected client.
- Configuration tests prove storage variables remain server-only and optional.
