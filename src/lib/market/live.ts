import type { Candle, LiveQuote, Quote, Range } from "./types";

/**
 * Client-side access to the server's provider proxy (`/api/market/*`).
 *
 * Every call is best-effort: on any failure it resolves to an empty result and
 * the app keeps running on the local simulator. The key is never involved here
 * — the browser only ever talks to our own route handlers.
 */

export type LiveConfig = {
  live: boolean;
  provider: string;
  label: string;
  cacheSeconds: number;
  capabilities: Record<string, boolean>;
  warning: string | null;
};

export const SIMULATED_CONFIG: LiveConfig = {
  live: false,
  provider: "simulated",
  label: "Local simulator",
  cacheSeconds: 45,
  capabilities: {},
  warning: null,
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchLiveConfig(): Promise<LiveConfig> {
  const data = await getJson<LiveConfig>("/api/market/config");
  return data ?? SIMULATED_CONFIG;
}

export async function fetchLiveQuotes(symbols: string[]): Promise<Record<string, LiveQuote>> {
  if (symbols.length === 0) return {};

  const data = await getJson<{ live: boolean; quotes: Record<string, LiveQuote> }>("/api/market/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbols }),
  });

  return data?.live ? data.quotes : {};
}

export type LiveSearchHit = { symbol: string; name: string; type: string };

export async function fetchLiveSearch(query: string): Promise<LiveSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const data = await getJson<{ live: boolean; results: LiveSearchHit[] }>(
    `/api/market/search?q=${encodeURIComponent(trimmed)}`,
  );

  return data?.live ? data.results : [];
}

export async function fetchLiveCandles(
  symbol: string,
  range: Range,
): Promise<{ candles: Candle[]; source: string }> {
  const data = await getJson<{ live: boolean; source: string; candles: Candle[] }>(
    `/api/market/candles?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
  );

  if (!data?.candles?.length) return { candles: [], source: "unavailable" };
  return { candles: data.candles, source: data.source };
}

const MAX_INTRADAY_POINTS = 180;

/**
 * Folds a provider quote into the app's `Quote` shape.
 *
 * The simulator's `volume` and the accumulated `intraday` path are preserved
 * (Finnhub's `/quote` supplies neither), so sparklines and volume panes keep
 * working while prices become real.
 */
export function mergeLiveQuote(
  symbol: string,
  live: LiveQuote,
  previous: Quote | undefined,
  now = Date.now(),
): Quote {
  const price = live.price;
  const prevClose = live.prevClose > 0 ? live.prevClose : previous?.prevClose ?? price;
  const direction: Quote["direction"] = previous
    ? price > previous.price
      ? "up"
      : price < previous.price
        ? "down"
        : "flat"
    : "flat";

  const intraday = previous?.intraday?.length
    ? [...previous.intraday, { t: live.updatedAt || now, p: price }].slice(-MAX_INTRADAY_POINTS)
    : seedIntraday(live, now);

  return {
    symbol,
    price,
    open: live.open > 0 ? live.open : previous?.open ?? price,
    prevClose,
    change: price - prevClose,
    changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    dayHigh: Math.max(live.dayHigh || 0, previous?.dayHigh ?? 0, price),
    dayLow: live.dayLow > 0 ? Math.min(live.dayLow, previous?.dayLow ?? Number.MAX_SAFE_INTEGER) : previous?.dayLow ?? price,
    volume: previous?.volume ?? 0,
    updatedAt: live.updatedAt || now,
    direction,
    intraday,
  };
}

/** Builds a short open→price path so charts are not empty on the first poll. */
function seedIntraday(live: LiveQuote, now: number): { t: number; p: number }[] {
  const open = live.open > 0 ? live.open : live.price;
  const steps = 14;
  const points: { t: number; p: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const wobble = Math.sin(i * 1.7) * Math.abs(live.price - open) * 0.18;
    points.push({
      t: now - (steps - i) * 5 * 60 * 1000,
      p: open + (live.price - open) * ratio + wobble,
    });
  }

  return points;
}
