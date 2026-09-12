"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { INSTRUMENTS_BY_SYMBOL } from "@/lib/market/catalog";
import { buildIndices, marketSession, type IndexQuote } from "@/lib/market/engine";
import { fetchLiveConfig, SIMULATED_CONFIG, type LiveConfig } from "@/lib/market/live";
import { marketStore, useMarketSnapshot } from "@/lib/market/store";
import type { Quote } from "@/lib/market/types";
import { usePortfolio } from "@/lib/store/provider";

const SESSION_PLACEHOLDER = { open: false, label: "Connecting…", phase: "closed" } as const;

type MarketContextValue = {
  quotes: Record<string, Quote>;
  indices: IndexQuote[];
  /** False during SSR and the first client render (keeps hydration identical). */
  ready: boolean;
  session: ReturnType<typeof marketSession>;
  lastTickAt: number;
  /** "live" once a provider quote has landed on the board, else "simulated". */
  source: "simulated" | "live";
  /** Provider id from `/api/market/config` (e.g. "finnhub" or "simulated"). */
  provider: string;
  providerLabel: string;
  /** True when a key is configured, even before the first poll returns. */
  liveConfigured: boolean;
  liveUpdatedAt: number;
  liveError: string | null;
  liveWarning: string | null;
  quote: (symbol: string) => Quote | undefined;
  price: (symbol: string) => number | null;
  changePct: (symbol: string) => number | null;
  /** Force a single price step — handy when live ticking is switched off. */
  step: () => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = usePortfolio();
  const snapshot = useMarketSnapshot();
  const { quotes, ready, lastTickAt, source, provider, liveUpdatedAt, liveError } = snapshot;

  const live = state.settings.livePrices;
  const autoFill = state.settings.autoFillLimits;
  const [config, setConfig] = useState<LiveConfig>(SIMULATED_CONFIG);

  // Ask the server whether a provider key is configured (the key itself never
  // reaches the browser).
  useEffect(() => {
    let cancelled = false;
    void fetchLiveConfig().then((resolved) => {
      if (!cancelled) setConfig(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    marketStore.configureProvider({
      enabled: config.live && live,
      provider: config.provider,
      pollMs: Math.max(30, config.cacheSeconds) * 1000,
    });
  }, [config.live, config.provider, config.cacheSeconds, live]);

  // Tell the shared store whether it should keep ticking.
  useEffect(() => {
    marketStore.setLive(live);
  }, [live]);

  // Open positions and the watchlist are polled first — they are what the user
  // is actually looking at. Keyed on a primitive so the effect only re-runs
  // when the symbol list really changes.
  const positions = state.positions;
  const watchlist = state.watchlist;
  const priorityKey = `${positions.map((position) => position.symbol).join(",")}|${watchlist.join(",")}`;

  useEffect(() => {
    const symbols = priorityKey.split("|").flatMap((group) => (group ? group.split(",") : []));
    marketStore.setPrioritySymbols(symbols);
  }, [priorityKey]);

  // Derived from lastTickAt so the value is identical on server and client.
  const session = ready ? marketSession(new Date(lastTickAt)) : SESSION_PLACEHOLDER;

  // Execute resting limit orders when the price crosses them.
  const orders = state.orders;
  useEffect(() => {
    if (!ready || !autoFill) return;
    for (const order of orders) {
      if (order.status !== "pending" || order.type !== "limit" || order.limitPrice === null) continue;
      const quote = quotes[order.symbol];
      if (!quote) continue;
      const hit = order.side === "buy" ? quote.price <= order.limitPrice : quote.price >= order.limitPrice;
      if (hit) {
        dispatch({ type: "fill-order", payload: { id: order.id, price: order.limitPrice } });
      }
    }
  }, [quotes, ready, autoFill, orders, dispatch]);

  const indices = useMemo(() => (ready ? buildIndices(quotes) : []), [quotes, ready]);
  const step = useCallback(() => marketStore.step(), []);

  const quote = useCallback((symbol: string) => quotes[symbol?.toUpperCase()], [quotes]);

  const price = useCallback(
    (symbol: string) => quotes[symbol?.toUpperCase()]?.price ?? INSTRUMENTS_BY_SYMBOL[symbol?.toUpperCase()]?.price ?? null,
    [quotes],
  );

  const changePct = useCallback(
    (symbol: string) =>
      quotes[symbol?.toUpperCase()]?.changePct ?? INSTRUMENTS_BY_SYMBOL[symbol?.toUpperCase()]?.changePct ?? null,
    [quotes],
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      quotes,
      indices,
      ready,
      session,
      lastTickAt,
      source,
      provider,
      providerLabel: config.label,
      liveConfigured: config.live,
      liveUpdatedAt,
      liveError,
      liveWarning: config.warning,
      quote,
      price,
      changePct,
      step,
    }),
    [
      quotes,
      indices,
      ready,
      session,
      lastTickAt,
      source,
      provider,
      config.label,
      config.live,
      config.warning,
      liveUpdatedAt,
      liveError,
      quote,
      price,
      changePct,
      step,
    ],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const context = useContext(MarketContext);
  if (!context) throw new Error("useMarket must be used inside <MarketProvider>");
  return context;
}

/** Convenience hook for a single symbol. */
export function useQuote(symbol: string): Quote | undefined {
  const { quotes } = useMarket();
  return quotes[symbol?.toUpperCase()];
}
