export type Sector =
  | "Technology"
  | "Financial Services"
  | "Healthcare"
  | "Consumer Cyclical"
  | "Consumer Defensive"
  | "Communication Services"
  | "Industrials"
  | "Energy"
  | "Utilities"
  | "Real Estate"
  | "Basic Materials"
  | "Funds & ETFs";

export type InstrumentKind = "stock" | "etf";

/** Static, human-curated reference data for a tradable instrument. */
export type Instrument = {
  symbol: string;
  name: string;
  kind: InstrumentKind;
  sector: Sector;
  industry: string;
  exchange: string;
  /** Reference price the simulator anchors to (USD). */
  price: number;
  /** Today's percentage move at the moment the simulator boots. */
  changePct: number;
  /** Annualised volatility used by the random-walk simulator. */
  volatility: number;
  marketCap: number;
  sharesOutstanding: number;
  pe: number | null;
  eps: number | null;
  dividendYield: number;
  beta: number;
  week52High: number;
  week52Low: number;
  avgVolume: number;
  ipoYear: number;
  hq: string;
  employees: string;
  ceo: string;
  /** Accent colour used for charts, avatars and allocation slices. */
  color: string;
  about: string;
  tags: string[];
};

export type Quote = {
  symbol: string;
  price: number;
  open: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  /** Timestamp of the most recent simulated tick. */
  updatedAt: number;
  /** Direction of the last tick, used for flash animations. */
  direction: "up" | "down" | "flat";
  /** Rolling intraday path, newest last. */
  intraday: { t: number; p: number }[];
};

/**
 * Slim quote as returned by the server's provider proxy. Merged into a full
 * `Quote` on the client by `mergeLiveQuote()` (see `src/lib/market/live.ts`).
 */
export type LiveQuote = {
  symbol: string;
  price: number;
  open: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  /** Provider timestamp, ms since epoch. */
  updatedAt: number;
};

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

export const RANGE_LABELS: Record<Range, string> = {
  "1D": "Today",
  "1W": "1 Week",
  "1M": "1 Month",
  "3M": "3 Months",
  "6M": "6 Months",
  "1Y": "1 Year",
  "5Y": "5 Years",
};
