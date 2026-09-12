import type { Metadata } from "next";

import { resolveInstrument } from "@/lib/market/providers/resolve";
import { StockView } from "@/components/views/stock-view";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const instrument = await resolveInstrument(decodeURIComponent(symbol));

  if (!instrument) {
    return { title: "Instrument not found", description: "That ticker isn't listed on Monievest." };
  }

  return {
    title: `${instrument.symbol} · ${instrument.name}`,
    description: `${instrument.name} (${instrument.symbol}) — price chart, key statistics, fundamentals, news and an order ticket to buy or sell on Monievest.`,
  };
}

/**
 * Deep links work for the whole listed universe when a provider key is set:
 * symbols outside the curated catalog are resolved server-side (the key stays
 * on the server) and handed to the view as a plain serialisable object.
 */
export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  const key = decodeURIComponent(symbol).toUpperCase();
  const instrument = await resolveInstrument(key);

  return <StockView symbol={key} instrument={instrument ?? undefined} />;
}
