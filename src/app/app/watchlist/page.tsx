import type { Metadata } from "next";

import { WatchlistView } from "@/components/views/watchlist-view";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Track the stocks and ETFs you care about with live simulated prices, day ranges and mini charts.",
};

export default function WatchlistPage() {
  return <WatchlistView />;
}
