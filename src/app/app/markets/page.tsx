import type { Metadata } from "next";

import { MarketsView } from "@/components/views/markets-view";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Browse every instrument on Monievest — filter by sector and type, sort by change, market cap, volume or dividend yield, and open an order ticket in one click.",
};

export default function MarketsPage() {
  return <MarketsView />;
}
