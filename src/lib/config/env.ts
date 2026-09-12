import "server-only";

/**
 * Single place that reads market-data configuration from the environment.
 *
 * Server-only by design: none of these names use the `NEXT_PUBLIC_` prefix, so
 * Next.js never inlines them into the browser bundle. Import this module from
 * route handlers, server components or server actions only.
 *
 * Everything is optional — with no key configured the app keeps running on the
 * local deterministic simulator (`src/lib/market/engine.ts`).
 */

export type MarketProviderId =
  | "simulated"
  | "finnhub"
  | "polygon"
  | "alphavantage"
  | "twelvedata";

type ProviderSpec = {
  id: MarketProviderId;
  label: string;
  keyVar: string;
  baseUrl: string;
};

export const MARKET_PROVIDERS: Record<MarketProviderId, ProviderSpec> = {
  simulated: {
    id: "simulated",
    label: "Local simulator",
    keyVar: "",
    baseUrl: "",
  },
  finnhub: {
    id: "finnhub",
    label: "Finnhub",
    keyVar: "FINNHUB_API_KEY",
    baseUrl: "https://finnhub.io/api/v1",
  },
  polygon: {
    id: "polygon",
    label: "Polygon.io",
    keyVar: "POLYGON_API_KEY",
    baseUrl: "https://api.polygon.io",
  },
  alphavantage: {
    id: "alphavantage",
    label: "Alpha Vantage",
    keyVar: "ALPHA_VANTAGE_API_KEY",
    baseUrl: "https://www.alphavantage.co/query",
  },
  twelvedata: {
    id: "twelvedata",
    label: "Twelve Data",
    keyVar: "TWELVE_DATA_API_KEY",
    baseUrl: "https://api.twelvedata.com",
  },
};

export type MarketConfig = {
  /** Provider requested via MARKET_DATA_PROVIDER (defaults to `simulated`). */
  requested: MarketProviderId;
  /** Provider actually in use — falls back to `simulated` when no key is set. */
  provider: MarketProviderId;
  label: string;
  apiKey: string | null;
  baseUrl: string;
  /** True when a real provider is configured and ready to be called. */
  live: boolean;
  /** Cache lifetime for server-side quote lookups. */
  cacheSeconds: number;
  /** Set when the requested provider could not be used, so callers can log why. */
  warning: string | null;
};

function readProviderId(raw: string | undefined): MarketProviderId {
  const value = (raw ?? "").trim().toLowerCase().replace(/[\s-]/g, "");
  switch (value) {
    case "finnhub":
      return "finnhub";
    case "polygon":
    case "polygonio":
      return "polygon";
    case "alphavantage":
    case "alpha":
    case "av":
      return "alphavantage";
    case "twelvedata":
    case "12data":
      return "twelvedata";
    default:
      return "simulated";
  }
}

/**
 * Resolves the configured provider once per process.
 *
 * A missing key is never fatal: it downgrades to the simulator and reports why
 * through `warning`, so the UI can stay honest ("simulated data") instead of
 * rendering empty charts.
 */
export function getMarketConfig(): MarketConfig {
  const requested = readProviderId(process.env.MARKET_DATA_PROVIDER);
  const spec = MARKET_PROVIDERS[requested];

  if (requested === "simulated") {
    return {
      requested,
      provider: "simulated",
      label: spec.label,
      apiKey: null,
      baseUrl: "",
      live: false,
      cacheSeconds: readCacheSeconds(),
      warning: null,
    };
  }

  const apiKey = (process.env[spec.keyVar] ?? "").trim();
  if (!apiKey) {
    return {
      requested,
      provider: "simulated",
      label: MARKET_PROVIDERS.simulated.label,
      apiKey: null,
      baseUrl: "",
      live: false,
      cacheSeconds: readCacheSeconds(),
      warning: `MARKET_DATA_PROVIDER="${requested}" but ${spec.keyVar} is empty — using the simulator.`,
    };
  }

  return {
    requested,
    provider: requested,
    label: spec.label,
    apiKey,
    baseUrl: (process.env.MARKET_DATA_BASE_URL ?? "").trim() || spec.baseUrl,
    live: true,
    cacheSeconds: readCacheSeconds(),
    warning: null,
  };
}

function readCacheSeconds(): number {
  const parsed = Number.parseInt(process.env.MARKET_DATA_CACHE_SECONDS ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 60;
  return Math.min(parsed, 3600);
}

/** Convenience guard for "should I call the network at all?". */
export function isLiveMarketEnabled(): boolean {
  return getMarketConfig().live;
}
