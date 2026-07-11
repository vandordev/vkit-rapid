export type TokenData = {
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: number;
  refresh_token_expires_at?: number;
};

type ApiResponse<T> = {
  data?: T | { data?: T };
};

const DEFAULT_AUTH_URL = "https://auth.oriskin.co.id";

function sanitizeBaseUrl(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/\/$/, "");
}

function parseMap(raw: string | undefined) {
  const map = new Map<string, string>();
  if (!raw) return map;

  for (const entry of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key && value) map.set(key, value);
  }

  return map;
}

export function resolveAuthBaseUrl() {
  const mapped = process.env.BACKEND_URL_MAP ? parseMap(process.env.BACKEND_URL_MAP).get("auth") : undefined;
  return sanitizeBaseUrl(mapped, process.env.AUTH_URL || process.env.NEXT_PUBLIC_AUTH_URL || DEFAULT_AUTH_URL);
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

export function extractTokenData(payload: ApiResponse<TokenData> | null | undefined): TokenData | null {
  if (!payload?.data) return null;

  const directData = payload.data as TokenData;
  if (directData.access_token || directData.refresh_token) return directData;

  const nestedData = (payload.data as { data?: TokenData }).data;
  if (nestedData?.access_token || nestedData?.refresh_token) return nestedData;

  return null;
}

export async function exchangeAuthCode(options: { baseUrl?: string; code: string }) {
  const baseUrl = sanitizeBaseUrl(options.baseUrl, `${resolveAuthBaseUrl()}/api/sso`);
  return requestJson<TokenData>(`${baseUrl}/token`, {
    method: "POST",
    body: JSON.stringify({ code: options.code }),
  });
}

export async function refreshAuthToken(refreshToken: string) {
  const query = new URLSearchParams({ refresh_token: refreshToken }).toString();
  return requestJson<TokenData>(`${resolveAuthBaseUrl()}/api/sso/refresh?${query}`);
}
