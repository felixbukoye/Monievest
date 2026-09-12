import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./config";

/**
 * Refreshes the auth session and enforces route protection.
 *
 * Called from `src/proxy.ts` on every `/app/*`, `/login` and `/signup` request.
 * When Supabase is not configured it returns the request untouched, so the app
 * keeps running in local guest mode exactly as before — nothing locks people
 * out just because the env vars are missing.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getSupabaseEnv();
  if (!env.configured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase: SupabaseClient = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Nothing between createServerClient() and this call — see the @supabase/ssr docs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected = pathname === "/app" || pathname.startsWith("/app/");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/app") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
