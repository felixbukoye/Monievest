import { NextResponse } from "next/server";

import { getMarketConfig } from "@/lib/config/env";
import { getHistory } from "@/lib/market/engine";
import { fetchCandles } from "@/lib/market/providers/finnhub";
import { resolveInstrument } from "@/lib/market/providers/resolve";
import { RANGES, type Range } from "@/lib/market/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historical candles, with honest provenance.
 *
 * `source: "finnhub"`   — real candles from the provider
 * `source: "simulated"` — the key cannot fetch candles (premium-gated on many
 *                         free tiers), so the deterministic simulator serves them
 * `source: "unavailable"` — unknown symbol and no provider
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  const range = (url.searchParams.get("range") ?? "1M") as Range;

  if (!symbol || !RANGES.includes(range)) {
    return NextResponse.json({ live: false, source: "unavailable", candles: [] }, { status: 400 });
  }

  const config = getMarketConfig();

  if (config.live) {
    const candles = await fetchCandles(symbol, range);
    if (candles && candles.length > 1) {
      return NextResponse.json({ live: true, source: "finnhub", candles });
    }
  }

  const instrument = await resolveInstrument(symbol);
  if (instrument) {
    return NextResponse.json({
      live: config.live,
      source: "simulated",
      candles: getHistory(instrument, range),
    });
  }

  return NextResponse.json({ live: config.live, source: "unavailable", candles: [] });
}
