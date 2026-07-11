import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME } from "@/constants/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_TOKEN_COOKIE_NAME);
  cookieStore.delete(AUTH_SESSION_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
