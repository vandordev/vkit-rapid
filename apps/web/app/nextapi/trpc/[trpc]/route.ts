import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/root";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/nextapi/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
