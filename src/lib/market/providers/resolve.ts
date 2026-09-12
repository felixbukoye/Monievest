import "server-only";

import { getInstrument } from "@/lib/market/catalog";
import { buildInstrument } from "./instrument-factory";
import { fetchProfile, fetchQuote } from "./finnhub";
import type { Instrument } from "@/lib/market/types";

/**
 * Resolves any symbol to an `Instrument`.
 *
 * Curated catalog first (rich, hand-written reference data). Anything else is
 * resolved through the configured provider so the whole listed universe is
 * reachable by deep link — `/app/stock/RIVN` works even though RIVN is not one
 * of the 44 seeded instruments.
 *
 * Returns `null` when the symbol is unknown *and* no provider is configured,
 * which is what turns the page into a 404.
 */
export async function resolveInstrument(symbol: string): Promise<Instrument | null> {
  const key = decodeURIComponent(symbol).toUpperCase().trim();
  if (!key) return null;

  const catalogued = getInstrument(key);
  if (catalogued) return catalogued;

  const quote = await fetchQuote(key);
  if (!quote) return null;

  const profile = await fetchProfile(key);
  const kind = /\.(ETF|EFT)$/i.test(key) ? "etf" : undefined;

  return buildInstrument({
    symbol: key,
    name: profile?.name,
    kind,
    industry: profile?.finnhubIndustry,
    exchange: profile?.exchange,
    price: quote.c,
    prevClose: quote.pc,
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined,
    sharesOutstanding: profile?.shareOutstanding ? profile.shareOutstanding * 1_000_000 : undefined,
    ipoYear: profile?.ipo ? Number.parseInt(profile.ipo.slice(0, 4), 10) || undefined : undefined,
    country: profile?.country,
    week52High: quote.h > 0 ? Math.max(quote.h, quote.c) : undefined,
    week52Low: quote.l > 0 ? Math.min(quote.l, quote.c) : undefined,
  });
}
