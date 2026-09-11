import type { Metadata } from "next";

import { DashboardView } from "@/components/views/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Monievest dashboard — total portfolio value, today's P&L, performance against the S&P 500, allocation, holdings and live market movers.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
