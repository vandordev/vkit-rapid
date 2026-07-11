import { SSO_CLIENT_ID } from "@/constants/auth";

const DEFAULT_AUTH_URL = "https://auth.oriskin.co.id";
const DEFAULT_APP_BASE_URL = "http://localhost:4100";

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function firstForwardedValue(value: string | null) {
  if (!value) return "";
  return value.split(",")[0]?.trim() || "";
}

export function getAuthUrl() {
  return sanitizeBaseUrl(process.env.NEXT_PUBLIC_AUTH_URL || process.env.AUTH_URL || DEFAULT_AUTH_URL);
}

export function getRequestBaseUrl(requestHeaders: Headers) {
  const forwardedProto = firstForwardedValue(requestHeaders.get("x-forwarded-proto"));
  const forwardedHost = firstForwardedValue(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost || requestHeaders.get("host") || "";

  if (host) {
    return `${forwardedProto || "http"}://${host}`;
  }

  return sanitizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE_URL);
}

export function buildAuthLoginUrl(currentBaseUrl: string) {
  const url = new URL(getAuthUrl());
  url.searchParams.set("client_id", SSO_CLIENT_ID);
  url.searchParams.set("redirect_url", `${sanitizeBaseUrl(currentBaseUrl)}/callback`);
  return url.toString();
}
