import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_AUTH_URL = "https://auth.oriskin.co.id";

const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
];

const BLOCKED_REQUEST_HEADERS = new Set([...HOP_BY_HOP_HEADERS, "accept-encoding"]);

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

function resolveBackendUrl(target: string): string | null {
  if (target === "auth") {
    return (
      parseMap(process.env.BACKEND_URL_MAP).get("auth") ??
      process.env.AUTH_URL ??
      process.env.NEXT_PUBLIC_AUTH_URL ??
      DEFAULT_AUTH_URL
    );
  }

  return parseMap(process.env.BACKEND_URL_MAP).get(target) ?? null;
}

function sanitizeHeaders(input: Headers): Headers {
  const headers = new Headers(input);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  return headers;
}

function buildProxyRequestHeaders(input: Headers): Headers {
  const headers = new Headers();

  for (const [key, value] of input.entries()) {
    const lowerKey = key.toLowerCase();
    if (BLOCKED_REQUEST_HEADERS.has(lowerKey)) continue;
    headers.set(key, value);
  }

  return headers;
}

async function proxy(req: NextRequest, context: { params: Promise<{ target: string; slug: string[] }> }) {
  const { target, slug } = await context.params;
  const backendUrl = resolveBackendUrl(target);

  if (!backendUrl) {
    return NextResponse.json(
      {
        message: `Unknown backend target "${target}"`,
        hint: "Set BACKEND_URL_MAP or AUTH_URL, e.g. auth=https://auth.oriskin.co.id",
      },
      { status: 404 },
    );
  }

  const slugPath = slug.join("/");
  const safePath = slugPath ? `/${slugPath}` : "";
  const url = `${backendUrl.replace(/\/$/, "")}${safePath}${req.nextUrl.search}`;
  const headers = buildProxyRequestHeaders(req.headers);

  let response: Response;
  try {
    response = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
    });
  } catch (error) {
    console.error(`[proxy:${target}] Failed request to ${url}`, error);
    return NextResponse.json(
      {
        message: "Failed to reach upstream backend",
        target,
      },
      { status: 502 },
    );
  }

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: sanitizeHeaders(response.headers),
  });
}

export function GET(req: NextRequest, ctx: { params: Promise<{ target: string; slug: string[] }> }) {
  return proxy(req, ctx);
}

export function POST(req: NextRequest, ctx: { params: Promise<{ target: string; slug: string[] }> }) {
  return proxy(req, ctx);
}

export function PUT(req: NextRequest, ctx: { params: Promise<{ target: string; slug: string[] }> }) {
  return proxy(req, ctx);
}

export function DELETE(req: NextRequest, ctx: { params: Promise<{ target: string; slug: string[] }> }) {
  return proxy(req, ctx);
}

export function PATCH(req: NextRequest, ctx: { params: Promise<{ target: string; slug: string[] }> }) {
  return proxy(req, ctx);
}
