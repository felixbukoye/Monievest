import type { Metadata } from "next";

import { WalletView } from "@/components/views/wallet-view";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Cash balance, buying power, deposits and withdrawals on your simulated Monievest account.",
};

export default function WalletPage() {
  return <WalletView />;
}
