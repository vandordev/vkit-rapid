import { timingSafeEqual } from "node:crypto";

export function isDocumentationAuthorized(authorization: string | undefined, username?: string, password?: string): boolean {
  if (!username && !password) return true;
  if (!username || !password || !authorization?.startsWith("Basic ")) return false;
  const expected = Buffer.from(`${username}:${password}`);
  const actual = Buffer.from(authorization.slice("Basic ".length), "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
