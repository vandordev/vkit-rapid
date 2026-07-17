export function normalizePrefix(prefix: string): string {
  const value = prefix.trim().replace(/^\/+|\/+$/g, "");
  if (!value || value.split("/").some((segment) => segment === "..")) throw new Error("Storage root prefix is invalid");
  return value;
}

export function sanitizeFileName(fileName: string): string {
  return fileName.normalize("NFKD").replace(/[^\w.() -]+/g, "_").replace(/\s+/g, "-").slice(0, 120) || "object";
}

export function buildObjectKey(input: { rootPrefix: string; fileName: string }): string {
  return `${normalizePrefix(input.rootPrefix)}/uploads/${crypto.randomUUID()}-${sanitizeFileName(input.fileName)}`;
}

export function assertObjectKey(rootPrefix: string, key: string): void {
  const prefix = `${normalizePrefix(rootPrefix)}/`;
  if (!key.startsWith(prefix) || key.split("/").includes("..")) throw new Error("Object key is outside configured prefix");
}
