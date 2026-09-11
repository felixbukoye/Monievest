import type { Metadata } from "next";

import { PortfolioView } from "@/components/views/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Holdings, sector allocation, unrealised and realised returns, concentration checks and a CSV export of your Monievest portfolio.",
};

export default function PortfolioPage() {
  return <PortfolioView />;
}
