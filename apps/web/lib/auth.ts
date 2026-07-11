import { cookies } from "next/headers";

import { AUTH_SESSION_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME } from "@/constants/auth";

import { extractTokenData, refreshAuthToken } from "./auth-api";

export async function authServer() {
  const token = await getValidAccessToken();
  return token ?? null;
}

export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  if (accessToken) {
    return accessToken;
  }

  const refreshToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshAuthToken(refreshToken);
    return extractTokenData(refreshed)?.access_token ?? null;
  } catch {
    return null;
  }
}
