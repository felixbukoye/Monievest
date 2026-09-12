import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Monievest to load your portfolio, watchlist and order history.",
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const requested = params?.next ?? "";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";

  return <AuthForm mode="login" next={next} configured={getSupabaseEnv().configured} />;
}
