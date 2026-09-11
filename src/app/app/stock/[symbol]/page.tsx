import type { Metadata } from "next";

import { getInstrument } from "@/lib/market/catalog";
import { StockView } from "@/components/views/stock-view";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const instrument = getInstrument(decodeURIComponent(symbol));

  if (!instrument) {
    return { title: "Instrument not found", description: "That ticker isn't listed on Monievest." };
  }

  return {
    title: `${instrument.symbol} · ${instrument.name}`,
    description: `${instrument.name} (${instrument.symbol}) — price chart, key statistics, fundamentals, simulated news and an order ticket to buy or sell on Monievest.`,
  };
}

export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  return <StockView symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
