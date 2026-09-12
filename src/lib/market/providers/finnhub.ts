import "server-only";

import { getMarketConfig } from "@/lib/config/env";
import type { Candle, Range } from "@/lib/market/types";

/**
 * ---------------------------------------------------------------------------
 * Finnhub provider client (server-only)
 * ---------------------------------------------------------------------------
 * The API key never leaves the server: this module is the only place that
 * reads it, and it is reachable exclusively from route handlers and server
 * components.
 *
 * Free-tier realities this code is built around:
 *  • ~60 calls/minute (we budget 50 and queue, then serve stale cache)
 *  • no batch quote endpoint — one call per symbol, so everything is cached
 *  • historical candles and company profiles are premium-gated on many free
 *    keys, so each capability is probed once and then switched off, letting
 *    callers fall back to the local simulator instead of retrying forever
 */

export type FinnhubQuote = {
  /** current price */ c: number;
  /** change */ d: number;
  /** percent change */ dp: number;
  /** high of day */ h: number;
  /** low of day */ l: number;
  /** open of day */ o: number;
  /** previous close */ pc: number;
  /** timestamp (seconds) */ t: number;
};

export type FinnhubSearchHit = {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
};

export type FinnhubProfile = {
  country?: string;
  currency?: string;
  exchange?: string;
  ipo?: string;
  marketCapitalization?: number; // millions
  name?: string;
  shareOutstanding?: number; // millions
  ticker?: string;
  weburl?: string;
  logo?: string;
  finnhubIndustry?: string;
};

export type FinnhubNewsItem = {
  id: number;
  datetime: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image?: string;
  category: string;
  related: string;
};

export type FinnhubCandles = {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
  s: string;
};

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/** Which endpoints this key is allowed to use; probed lazily. */
export const capabilities = {
  quotes: true,
  candles: true,
  search: true,
  profile: true,
  news: true,
};

export type CapabilityName = keyof typeof capabilities;

export type ProviderDiagnostics = {
  /** What the provider last said when something failed — surfaced in the UI. */
  lastError: { status: number; message: string; at: number } | null;
  /** Calls made in the trailing minute, so the free-tier budget is visible. */
  callsLastMinute: number;
  cacheEntries: number;
  capabilities: Record<CapabilityName, boolean>;
};

let lastError: ProviderDiagnostics["lastError"] = null;

function recordError(status: number, message: string) {
  lastError = { status, message, at: Date.now() };
}

export function getDiagnostics(): ProviderDiagnostics {
  const now = Date.now();
  while (stamps.length > 0 && now - stamps[0]! > 60_000) stamps.shift();

  return {
    lastError,
    callsLastMinute: stamps.length,
    cacheEntries: cache.size,
    capabilities: { ...capabilities },
  };
}

const TIMEOUT_MS = 9000;
const BUDGET_PER_MINUTE = 55;
const MAX_QUEUE_WAIT_MS = 4000;
const MAX_CACHE_ENTRIES = 4000;

const cache = new Map<string, { at: number; value: unknown }>();
const stamps: number[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sliding-window limiter: waits for budget, then gives up and uses cache. */
async function takeSlot(): Promise<boolean> {
  const deadline = Date.now() + MAX_QUEUE_WAIT_MS;

  for (;;) {
    const now = Date.now();
    while (stamps.length > 0 && now - stamps[0]! > 60_000) stamps.shift();

    if (stamps.length < BUDGET_PER_MINUTE) {
      stamps.push(now);
      return true;
    }

    const wait = Math.min(60_000 - (now - stamps[0]!) + 10, deadline - now);
    if (wait <= 0) return false;
    await sleep(wait);
    if (Date.now() >= deadline) return false;
  }
}

function cacheWrite(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function disableCapabilityFor(path: string) {
  if (path.startsWith("/stock/candle")) capabilities.candles = false;
  else if (path.startsWith("/stock/profile2")) capabilities.profile = false;
  else if (path.startsWith("/company-news")) capabilities.news = false;
  else if (path.startsWith("/search")) capabilities.search = false;
  else if (path.startsWith("/quote")) capabilities.quotes = false;
}

function capabilityFor(path: string): CapabilityName | null {
  if (path.startsWith("/stock/candle")) return "candles";
  if (path.startsWith("/stock/profile2")) return "profile";
  if (path.startsWith("/company-news")) return "news";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/quote")) return "quotes";
  return null;
}

async function get<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  ttlMs: number,
): Promise<ProviderResult<T>> {
  const config = getMarketConfig();
  if (!config.live) return { ok: false, status: 0, message: "live market data is not configured" };

  const capability = capabilityFor(path);
  if (capability && !capabilities[capability]) {
    return { ok: false, status: 403, message: `${capability} unavailable on this key` };
  }

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
  const cacheKey = `${path}?${query}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlMs) return { ok: true, data: hit.value as T };

  if (!(await takeSlot())) {
    return hit
      ? { ok: true, data: hit.value as T }
      : { ok: false, status: 429, message: "rate-limit budget exhausted" };
  }

  const url = `${config.baseUrl}${path}${query ? `?${query}&` : "?"}token=${encodeURIComponent(config.apiKey!)}`;

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) disableCapabilityFor(path);
      const message =
        response.status === 401
          ? "Finnhub rejected the API key (401). Check FINNHUB_API_KEY in .env.local."
          : response.status === 403
            ? `Finnhub refused ${path} (403) — this endpoint is not on your plan, so the simulator serves it.`
            : `Finnhub responded ${response.status} for ${path}.`;
      recordError(response.status, message);
      return { ok: false, status: response.status, message };
    }

    const data = (await response.json()) as T;
    cacheWrite(cacheKey, data);
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    recordError(0, `Could not reach Finnhub (${path}): ${message}`);
    return { ok: false, status: 0, message };
  }
}

function quoteTtl(): number {
  return getMarketConfig().cacheSeconds * 1000;
}

/* ------------------------------------------------------------------ quotes */

export async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const result = await get<FinnhubQuote>("/quote", { symbol }, quoteTtl());
  if (!result.ok) return null;
  // Finnhub answers 200 with all-zero fields for symbols it does not cover.
  if (!result.data || !(result.data.c > 0)) return null;
  return result.data;
}

/**
 * One call per symbol (there is no batch endpoint), so results are returned
 * per-symbol and anything the budget could not cover is simply omitted — the
 * client keeps the last known value for those.
 */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, FinnhubQuote>> {
  const out: Record<string, FinnhubQuote> = {};

  for (const raw of symbols) {
    const symbol = raw.toUpperCase();
    if (!symbol || out[symbol]) continue;
    // Once quotes are known to be blocked, stop spending the budget.
    if (!capabilities.quotes) break;
    const quote = await fetchQuote(symbol);
    if (quote) out[symbol] = quote;
  }

  return out;
}

/* ----------------------------------------------------------------- candles */

const RANGE_TO_RESOLUTION: Record<Range, { resolution: string; days: number }> = {
  "1D": { resolution: "5", days: 1 },
  "1W": { resolution: "30", days: 7 },
  "1M": { resolution: "60", days: 31 },
  "3M": { resolution: "D", days: 93 },
  "6M": { resolution: "D", days: 186 },
  "1Y": { resolution: "D", days: 372 },
  "5Y": { resolution: "W", days: 1830 },
};

export function toCandles(data: FinnhubCandles): Candle[] {
  if (!data || data.s !== "ok" || !Array.isArray(data.t)) return [];

  return data.t.map((seconds, index) => ({
    t: seconds * 1000,
    o: data.o?.[index] ?? data.c?.[index] ?? 0,
    h: data.h?.[index] ?? data.c?.[index] ?? 0,
    l: data.l?.[index] ?? data.c?.[index] ?? 0,
    c: data.c?.[index] ?? 0,
    v: data.v?.[index] ?? 0,
  }));
}

export async function fetchCandles(symbol: string, range: Range): Promise<Candle[] | null> {
  if (!capabilities.candles) return null;

  const { resolution, days } = RANGE_TO_RESOLUTION[range];
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86_400;

  const result = await get<FinnhubCandles>(
    "/stock/candle",
    { symbol, resolution, from, to },
    15 * 60 * 1000,
  );

  if (!result.ok) return null;
  if (result.data?.s && result.data.s !== "ok") {
    // "no_permission" on free keys — stop probing and let the simulator serve.
    disableCapabilityFor("/stock/candle");
    recordError(403, `Finnhub candles are not available on this key (${result.data.s}) — charts use simulated history.`);
    return null;
  }

  const candles = toCandles(result.data);
  return candles.length > 1 ? candles : null;
}

/* ------------------------------------------------------------------ search */

export async function searchUniverse(
  query: string,
  limit = 10,
): Promise<{ symbol: string; name: string; type: string }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const result = await get<{ count?: number; result?: FinnhubSearchHit[] }>(
    "/search",
    { q: trimmed },
    10 * 60 * 1000,
  );

  if (!result.ok || !Array.isArray(result.data?.result)) return [];

  const seen = new Set<string>();
  const out: { symbol: string; name: string; type: string }[] = [];

  for (const hit of result.data.result) {
    const symbol = (hit.displaySymbol || hit.symbol || "").toUpperCase();
    // Skip foreign listings with dots (e.g. "VOD.L") unless the user typed one.
    if (!symbol || seen.has(symbol)) continue;
    if (symbol.includes(".") && !trimmed.includes(".")) continue;
    seen.add(symbol);
    out.push({ symbol, name: hit.description || symbol, type: hit.type || "Common Stock" });
    if (out.length >= limit) break;
  }

  return out;
}

/* ----------------------------------------------------------------- profile */

export async function fetchProfile(symbol: string): Promise<FinnhubProfile | null> {
  if (!capabilities.profile) return null;

  const result = await get<FinnhubProfile>("/stock/profile2", { symbol }, 24 * 60 * 60 * 1000);
  if (!result.ok) return null;
  if (!result.data || Object.keys(result.data).length === 0) {
    disableCapabilityFor("/stock/profile2");
    return null;
  }
  return result.data;
}

/* -------------------------------------------------------------------- news */

export async function fetchCompanyNews(symbol: string, days = 7): Promise<FinnhubNewsItem[] | null> {
  if (!capabilities.news) return null;

  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  const result = await get<FinnhubNewsItem[]>(
    "/company-news",
    { symbol, from: iso(from), to: iso(to) },
    10 * 60 * 1000,
  );

  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null;
  return result.data;
}
