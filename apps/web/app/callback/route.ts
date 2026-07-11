import { type NextRequest, NextResponse } from "next/server";

import { getRequestBaseUrl } from "@/lib/sso";

export async function GET(req: NextRequest) {
  const callbackUrl = new URL("/nextapi/auth/callback", getRequestBaseUrl(req.headers));
  callbackUrl.search = req.nextUrl.search;

  return NextResponse.redirect(callbackUrl);
}
