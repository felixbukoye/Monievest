export type SupabaseEnv = {
  /** True only when both the URL and the anon key are present. */
  configured: boolean;
  url: string;
  anonKey: string;
};

/**
 * Reads the Supabase connection settings.
 *
 * Both values are `NEXT_PUBLIC_` on purpose: the anon key is a *publishable*
 * key that is designed to run in the browser. Security comes from Postgres Row
 * Level Security (see `supabase/migrations/0001_init.sql`), which restricts
 * every row to `auth.uid()`. Never put the `service_role` key in this file or
 * anywhere near the client — it bypasses RLS entirely.
 *
 * Edge-safe: no Node-only imports, so `src/proxy.ts` can use it too.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  return {
    configured: url.length > 0 && anonKey.length > 0 && /^https?:\/\//.test(url),
    url,
    anonKey,
  };
}
