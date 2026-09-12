import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Next 16's request proxy (the file previously named `middleware.ts`).
 *
 * Runs before every matched route to refresh the Supabase session cookie and
 * redirect unauthenticated visitors away from `/app/*`.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
