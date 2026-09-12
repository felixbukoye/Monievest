import type { Instrument, InstrumentKind, Sector } from "@/lib/market/types";

/**
 * Builds a full `Instrument` from whatever a live provider gives us.
 *
 * Isomorphic on purpose: the server uses it to resolve deep links for symbols
 * outside the curated catalog, and the client uses it to register search
 * results so the rest of the app (avatars, charts, order ticket) can treat a
 * live symbol exactly like a catalogued one.
 */

const PALETTE = [
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#ef4444",
];

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Deterministic accent colour so a symbol looks the same everywhere. */
export function colorFor(symbol: string): string {
  return PALETTE[hashString(symbol.toUpperCase()) % PALETTE.length]!;
}

const INDUSTRY_TO_SECTOR: [RegExp, Sector][] = [
  [/\b(etf|fund|trust|index)\b/i, "Funds & ETFs"],
  [/\b(bank|financial|insurance|capital market|asset management|credit)\b/i, "Financial Services"],
  [/\b(health|drug|biotech|medical|pharma|diagnostic)\b/i, "Healthcare"],
  [/\b(software|semiconductor|hardware|internet|cloud|data|computer|electronic|tech)\b/i, "Technology"],
  [/\b(telecom|media|entertainment|publishing|broadcast|advertising)\b/i, "Communication Services"],
  [/\b(retail|apparel|restaurant|auto|leisure|consumer|packaged|food|beverage)\b/i, "Consumer Cyclical"],
  [/\b(utilities|electric|gas|water|independent power)\b/i, "Utilities"],
  [/\b(real estate|reit)\b/i, "Real Estate"],
  [/\b(energy|oil|drilling|refining)\b/i, "Energy"],
  [/\b(industrial|aerospace|defense|rail|truck|marine|machinery|construction)\b/i, "Industrials"],
  [/\b(chemical|steel|gold|silver|copper|aluminum|paper|material|packaging)\b/i, "Basic Materials"],
  [/\b(grocery|household|tobacco|beverage|defensive)\b/i, "Consumer Defensive"],
];

export function sectorFromIndustry(industry: string | undefined, kind: InstrumentKind): Sector {
  if (kind === "etf") return "Funds & ETFs";
  if (!industry) return "Technology";
  for (const [pattern, sector] of INDUSTRY_TO_SECTOR) {
    if (pattern.test(industry)) return sector;
  }
  return "Consumer Cyclical";
}

export type InstrumentSeed = {
  symbol: string;
  name?: string;
  kind?: InstrumentKind;
  industry?: string;
  exchange?: string;
  price?: number;
  prevClose?: number;
  marketCap?: number;
  sharesOutstanding?: number;
  ipoYear?: number;
  country?: string;
  week52High?: number;
  week52Low?: number;
  dividendYield?: number;
  beta?: number;
  about?: string;
  tags?: string[];
  color?: string;
};

export function buildInstrument(seed: InstrumentSeed): Instrument {
  const symbol = seed.symbol.toUpperCase();
  const kind = seed.kind ?? (/^(V|I|Q|S)[A-Z]{2}$|ETF/i.test(symbol) ? "etf" : "stock");
  const price = Math.max(seed.price ?? 0, 0);
  const prevClose = seed.prevClose && seed.prevClose > 0 ? seed.prevClose : price;
  const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  const sector = sectorFromIndustry(seed.industry, kind);
  const name = seed.name?.trim() || symbol;

  return {
    symbol,
    name,
    kind,
    sector,
    industry: seed.industry?.trim() || (kind === "etf" ? "Index fund" : sector),
    exchange: seed.exchange?.trim() || "US",
    price,
    changePct,
    volatility: 0.28,
    marketCap: seed.marketCap ?? (price > 0 ? Math.round(price * (seed.sharesOutstanding ?? 50_000_000)) : 0),
    sharesOutstanding: seed.sharesOutstanding ?? 50_000_000,
    pe: null,
    eps: null,
    dividendYield: seed.dividendYield ?? 0,
    beta: seed.beta ?? 1,
    week52High: seed.week52High ?? price * 1.25,
    week52Low: seed.week52Low ?? price * 0.75,
    avgVolume: 5_000_000,
    ipoYear: seed.ipoYear ?? 2000,
    hq: seed.country?.trim() || "United States",
    employees: "—",
    ceo: "—",
    color: seed.color ?? colorFor(symbol),
    about:
      seed.about?.trim() ||
      `${name} (${symbol}) trades on ${seed.exchange?.trim() || "US markets"}. Reference data was resolved live from the configured market-data provider; statistics that the provider does not supply are shown as estimates.`,
    tags: seed.tags ?? ["Live universe"],
  };
}
