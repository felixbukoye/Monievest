"use client";

import * as React from "react";

import { fetchLiveCandles } from "./live";
import { getLiveCandles, setLiveCandles, subscribeLiveHistory } from "./live-history";
import type { Range } from "./types";

/**
 * Pulls real candles for one symbol/range into the shared live-history cache.
 *
 * `getHistory()` in the engine reads that cache first, so the chart, the
 * sparklines and any selector that replays history all upgrade to real data
 * once this resolves — no prop drilling, and nothing changes when live data is
 * disabled (the hook simply does not fetch).
 *
 * Returns a `version` counter that bumps whenever the cache changes, so callers
 * can re-render and pick the new series up.
 */
export function useLiveHistory(symbol: string | undefined, range: Range, enabled: boolean): number {
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => subscribeLiveHistory(() => setVersion((value) => value + 1)), []);

  React.useEffect(() => {
    if (!enabled || !symbol) return;
    if (getLiveCandles(symbol, range)) return;

    let cancelled = false;
    void fetchLiveCandles(symbol, range).then(({ candles, source }) => {
      if (cancelled || candles.length === 0) return;
      // Only trust provider history; the server's simulated fallback would just
      // duplicate what the engine already generates locally.
      if (source !== "finnhub") return;
      setLiveCandles(symbol, range, candles);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, symbol, range]);

  return version;
}
