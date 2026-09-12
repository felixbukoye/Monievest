import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Monievest account and start investing with $25,000 in demo cash.",
  robots: { index: false },
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const requested = params?.next ?? "";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";

  return <AuthForm mode="signup" next={next} configured={getSupabaseEnv().configured} />;
}
