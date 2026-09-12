import { NextResponse } from "next/server";

import { getMarketConfig } from "@/lib/config/env";
import { searchUniverse } from "@/lib/market/providers/finnhub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live symbol search across the provider's whole listed universe — this is what
 * makes tickers outside the curated 44-symbol catalog discoverable.
 *
 * Results are lightweight ({symbol, name, type}) on purpose: resolving full
 * reference data per hit would burn the free-tier budget. The stock page
 * resolves the instrument properly when the user opens it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const config = getMarketConfig();

  if (!config.live || query.length === 0) {
    return NextResponse.json({ live: config.live, results: [] });
  }

  const results = await searchUniverse(query, 10);
  return NextResponse.json({ live: true, results });
}
