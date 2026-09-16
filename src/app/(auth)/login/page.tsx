import type { Metadata } from "next";
import { BanIcon } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Monievest to load your portfolio, watchlist and order history.",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const requested = params?.next ?? "";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";
  const disabled = params?.error === "disabled";

  return (
    <div className="flex flex-col gap-4">
      {disabled ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px]">
          <BanIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">This account has been disabled by an administrator.</span>{" "}
            If you think that&apos;s a mistake, contact the Monievest team.
          </p>
        </div>
      ) : null}
      <AuthForm mode="login" next={next} configured={getSupabaseEnv().configured} />
    </div>
  );
}
