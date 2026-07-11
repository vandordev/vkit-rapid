import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME } from "@/constants/auth";
import { exchangeAuthCode, extractTokenData } from "@/lib/auth-api";
import { buildAuthLoginUrl, getRequestBaseUrl } from "@/lib/sso";

function redirectToAuth(req: NextRequest) {
  return NextResponse.redirect(buildAuthLoginUrl(getRequestBaseUrl(req.headers)));
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return redirectToAuth(req);
  }

  const requestBaseUrl = getRequestBaseUrl(req.headers);
  const preferredBaseUrl = `${requestBaseUrl}/nextapi/backends/auth/api/sso`;
  const tokenResponse = await exchangeAuthCode({ baseUrl: preferredBaseUrl, code }).catch((error) => {
    console.error(`[auth-callback] Token exchange failed via ${preferredBaseUrl}/token`, error);
    return null;
  });

  const tokenData = extractTokenData(tokenResponse);
  if (!tokenData?.access_token || !tokenData?.refresh_token) {
    console.error("[auth-callback] Missing access/refresh token in token response", tokenResponse?.data ?? tokenResponse);
    return redirectToAuth(req);
  }

  const cookieStore = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const accessMaxAge = tokenData.access_token_expires_at
    ? Math.max(1, tokenData.access_token_expires_at - now)
    : 60 * 60;
  const refreshMaxAge = tokenData.refresh_token_expires_at
    ? Math.max(1, tokenData.refresh_token_expires_at - now)
    : 60 * 60 * 24 * 30;
  const forwardedProto = req.headers.get("x-forwarded-proto") || "";
  const isSecure = req.nextUrl.protocol === "https:" || forwardedProto.includes("https");

  cookieStore.set(AUTH_TOKEN_COOKIE_NAME, tokenData.access_token, {
    secure: isSecure,
    sameSite: "lax",
    maxAge: accessMaxAge,
    path: "/",
  });

  cookieStore.set(AUTH_SESSION_COOKIE_NAME, tokenData.refresh_token, {
    secure: isSecure,
    sameSite: "lax",
    maxAge: refreshMaxAge,
    path: "/",
  });

  return NextResponse.redirect(`${requestBaseUrl}/`);
}
