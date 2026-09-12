import { NextResponse } from "next/server";

import { getMarketConfig } from "@/lib/config/env";
import { fetchQuotes } from "@/lib/market/providers/finnhub";
import type { LiveQuote } from "@/lib/market/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Finnhub has no batch endpoint, so each symbol costs one rate-limited call. */
const MAX_SYMBOLS_PER_REQUEST = 40;

export async function POST(request: Request) {
  const config = getMarketConfig();
  if (!config.live) {
    return NextResponse.json({ live: false, quotes: {}, missing: [] });
  }

  const body = (await request.json().catch(() => null)) as { symbols?: unknown } | null;
  const requested = Array.isArray(body?.symbols) ? body!.symbols : [];

  const symbols = requested
    .filter((symbol): symbol is string => typeof symbol === "string" && symbol.trim().length > 0)
    .map((symbol) => symbol.trim().toUpperCase())
    .slice(0, MAX_SYMBOLS_PER_REQUEST);

  if (symbols.length === 0) {
    return NextResponse.json({ live: true, quotes: {}, missing: [] });
  }

  const raw = await fetchQuotes(symbols);
  const quotes: Record<string, LiveQuote> = {};

  for (const [symbol, quote] of Object.entries(raw)) {
    quotes[symbol] = {
      symbol,
      price: quote.c,
      open: quote.o,
      prevClose: quote.pc,
      change: quote.d,
      changePct: quote.dp,
      dayHigh: quote.h,
      dayLow: quote.l,
      updatedAt: quote.t > 0 ? quote.t * 1000 : Date.now(),
    };
  }

  return NextResponse.json({
    live: true,
    quotes,
    missing: symbols.filter((symbol) => !quotes[symbol]),
  });
}
