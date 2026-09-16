import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardView } from "@/components/views/dashboard-view";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Monievest dashboard — total portfolio value, today's P&L, performance against the S&P 500, allocation, holdings and live market movers.",
};

export default async function DashboardPage() {
  // Admins land on the admin dashboard instead of the personal one.
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") redirect("/app/admin");

  return <DashboardView />;
}
