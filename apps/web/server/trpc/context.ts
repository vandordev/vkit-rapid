import { cookies } from "next/headers";

import { authServer } from "@/lib/auth";

export async function createTRPCContext() {
  const cookieStore = await cookies();
  const token = await authServer();

  return {
    token,
    cookieStore,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
