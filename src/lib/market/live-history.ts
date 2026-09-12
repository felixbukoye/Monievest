import type { Candle, Range } from "./types";

/**
 * Client-side cache of provider-supplied history.
 *
 * `getHistory()` in the engine checks this first, so the moment real candles
 * arrive for a symbol/range every consumer — price chart, sparklines,
 * `periodChangePct()`, the portfolio performance replay — upgrades to real
 * history without any of them needing to know about the network.
 */

const store = new Map<string, Candle[]>();
const listeners = new Set<() => void>();

const key = (symbol: string, range: Range) => `${symbol.toUpperCase()}:${range}`;

export function getLiveCandles(symbol: string, range: Range): Candle[] | undefined {
  return store.get(key(symbol, range));
}

export function setLiveCandles(symbol: string, range: Range, candles: Candle[]): void {
  if (!candles || candles.length < 2) return;
  const cacheKey = key(symbol, range);
  const existing = store.get(cacheKey);
  if (existing && existing.length === candles.length && existing[existing.length - 1]?.t === candles[candles.length - 1]?.t) {
    return;
  }
  store.set(cacheKey, candles);
  for (const listener of Array.from(listeners)) listener();
}

export function hasLiveCandles(symbol: string, range: Range): boolean {
  return store.has(key(symbol, range));
}

export function subscribeLiveHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
