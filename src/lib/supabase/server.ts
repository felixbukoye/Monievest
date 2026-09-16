import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

/** The caller's own profile row (RLS limits this to `auth.uid()`). */
export type ServerProfile = {
  id: string;
  display_name: string;
  email: string | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  created_at: string;
};

/**
 * The signed-in user's own profile row, or `null` when anonymous or when
 * Supabase is not configured (guest mode).
 */
export async function getCurrentProfile(): Promise<ServerProfile | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id,display_name,email,role,status,created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (data as ServerProfile | null) ?? null;
}

/**
 * Gate for `/app/admin`: redirects everyone who is not an admin.
 * Returns the admin's profile when access is granted.
 */
export async function requireAdminProfile(): Promise<ServerProfile> {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/app");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/admin");

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/app");
  return profile;
}

/**
 * Blocks disabled accounts from the app.
 *
 * Called from the `/app/*` layout: when the caller's profile is marked
 * `status = 'disabled'` (set by an admin from the admin dashboard), the
 * session is ended server-side and the visitor is sent back to the sign-in
 * page with an explanation. Never throws for guests or unconfigured envs.
 */
export async function enforceAccountStatus(): Promise<void> {
  const supabase = await createSupabaseServer();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // the proxy already bounces signed-out visitors

  const { data } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle<{ status: string }>();

  if (data?.status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?error=disabled");
  }
}
