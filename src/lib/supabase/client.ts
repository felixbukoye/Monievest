import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./config";

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client (session lives in cookies, so the server can read it
 * too). Returns `null` when the project is not configured — callers fall back
 * to local guest mode.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env.configured) return null;
  if (cached) return cached;

  cached = createBrowserClient(env.url, env.anonKey);
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().configured;
}
