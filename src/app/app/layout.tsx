import { AppShell } from "@/components/app/app-shell";
import { enforceAccountStatus } from "@/lib/supabase/server";
import type { ReactNode } from "react";

/**
 * The gates below (disabled-account check, admin redirect) must run on every
 * request, never from a prerendered snapshot — so never allow /app/* to be
 * emitted as static HTML.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Kicks out accounts an admin has disabled (no-op for guests / local mode).
  await enforceAccountStatus();

  return <AppShell>{children}</AppShell>;
}
