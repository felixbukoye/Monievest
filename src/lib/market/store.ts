import { useSyncExternalStore } from "react";

import { buildQuotes, tickQuotes } from "./engine";
import type { Quote } from "./types";

/**
 * ---------------------------------------------------------------------------
 * Market store
 * ---------------------------------------------------------------------------
 * A tiny external store holding the simulated quote board. Exposing it through
 * `useSyncExternalStore` gives us three things for free:
 *
 *  1. A stable server snapshot (the empty board) so SSR markup and the first
 *     client render always match — no hydration warnings, no price flash.
 *  2. One shared ticking interval for the whole app instead of one per
 *     component that happens to read a quote.
 *  3. Automatic re-renders only for components that actually subscribe.
 */

export type MarketSnapshot = {
  quotes: Record<string, Quote>;
  ready: boolean;
  lastTickAt: number;
};

const EMPTY: MarketSnapshot = { quotes: {}, ready: false, lastTickAt: 0 };
const TICK_MS = 2200;

let snapshot: MarketSnapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let liveEnabled = true;

function emit() {
  for (const listener of Array.from(listeners)) listener();
}

function boot(): boolean {
  if (snapshot.ready) return false;
  const now = Date.now();
  snapshot = { quotes: buildQuotes(now), ready: true, lastTickAt: now };
  return true;
}

function start() {
  if (timer !== null || typeof window === "undefined") return;
  timer = setInterval(() => {
    if (!liveEnabled || !snapshot.ready) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const now = Date.now();
    snapshot = { quotes: tickQuotes(snapshot.quotes, now), ready: true, lastTickAt: now };
    emit();
  }, TICK_MS);
}

function stop() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    const booted = boot();
    start();
    // Never emit synchronously from inside subscribe.
    if (booted) queueMicrotask(emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export const marketStore = {
  subscribe,
  getSnapshot: () => snapshot,
  getServerSnapshot: () => EMPTY,
  setLive(enabled: boolean) {
    liveEnabled = enabled;
  },
  isLive() {
    return liveEnabled;
  },
  /** Advance the board immediately (used when live ticking is paused). */
  step() {
    if (!snapshot.ready) {
      boot();
      emit();
      return;
    }
    const now = Date.now();
    snapshot = { quotes: tickQuotes(snapshot.quotes, now), ready: true, lastTickAt: now };
    emit();
  },
};

export function useMarketSnapshot(): MarketSnapshot {
  return useSyncExternalStore(marketStore.subscribe, marketStore.getSnapshot, marketStore.getServerSnapshot);
}
