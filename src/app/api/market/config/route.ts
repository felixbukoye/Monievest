import { NextResponse } from "next/server";

import { getMarketConfig } from "@/lib/config/env";
import { capabilities } from "@/lib/market/providers/finnhub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the client whether live provider data is available — without ever
 * exposing the key. The client uses this to switch the market store from
 * simulated ticking to provider polling.
 */
export async function GET() {
  const config = getMarketConfig();

  return NextResponse.json({
    live: config.live,
    provider: config.provider,
    label: config.label,
    cacheSeconds: config.cacheSeconds,
    capabilities: { ...capabilities },
    warning: config.warning,
  });
}
