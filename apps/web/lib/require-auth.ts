import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authServer } from "@/lib/auth";
import { buildAuthLoginUrl, getRequestBaseUrl } from "@/lib/sso";

type RequireAuthDependencies = {
  authServer: () => Promise<string | null>;
  headers: () => Promise<Headers>;
  redirect: (url: string) => never;
};

export async function requireAuthWithDependencies(dependencies: RequireAuthDependencies) {
  const token = await dependencies.authServer();
  if (token) {
    return token;
  }

  const requestHeaders = await dependencies.headers();
  dependencies.redirect(buildAuthLoginUrl(getRequestBaseUrl(requestHeaders)));
}

export async function requireAuth() {
  return requireAuthWithDependencies({
    authServer,
    headers,
    redirect,
  });
}
