import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./config";

/**
 * Supabase client for server components, server actions and route handlers.
 *
 * Returns `null` when the project is not configured so callers can fall back to
 * local guest mode instead of crashing. A fresh client is created per request —
 * never cache one across requests.
 */
export async function createSupabaseServer(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env.configured) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component, where cookies are read-only. The
          // proxy refreshes the session on the next request instead.
        }
      },
    },
  });
}

/** The signed-in user, or `null` when anonymous / unconfigured. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
