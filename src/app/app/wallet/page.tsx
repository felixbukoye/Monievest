import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WalletView } from "@/components/views/wallet-view";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Cash balance, buying power, deposits and withdrawals on your simulated Monievest account.",
};

/**
 * The wallet is an investor feature. Admin accounts have no cash balance, no
 * deposits and no withdrawals — they are sent back to the admin console, which
 * is the only place the admin chrome links to anyway.
 */
export default async function WalletPage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") redirect("/app/admin");

  return <WalletView />;
}
