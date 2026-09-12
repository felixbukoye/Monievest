import { useSyncExternalStore } from "react";

import { CATALOG } from "./catalog";
import { buildQuotes, tickQuotes } from "./engine";
import { fetchLiveQuotes, mergeLiveQuote, type LiveDiagnostics } from "./live";
import { dynamicSymbols } from "./registry";
import type { Quote } from "./types";

/**
 * ---------------------------------------------------------------------------
 * Market store
 * ---------------------------------------------------------------------------
 * A tiny external store holding the quote board. Exposing it through
 * `useSyncExternalStore` gives us three things for free:
 *
 *  1. A stable server snapshot (the empty board) so SSR markup and the first
 *     client render always match — no hydration warnings, no price flash.
 *  2. One shared ticking interval for the whole app instead of one per
 *     component that happens to read a quote.
 *  3. Automatic re-renders only for components that actually subscribe.
 *
 * Two data sources feed it:
 *  • the local deterministic simulator (default, always available), and
 *  • a live provider, polled through our own `/api/market/quotes` proxy when a
 *    key is configured. Real prices are merged over the simulated board, so
 *    anything the provider does not cover (volume, intraday path, uncovered
 *    symbols) keeps working instead of going blank.
 */

export type MarketSnapshot = {
  quotes: Record<string, Quote>;
  ready: boolean;
  lastTickAt: number;
  /** Which source produced the prices currently on the board. */
  source: "simulated" | "live";
  provider: string;
  /** Timestamp of the last successful provider poll (0 when simulated). */
  liveUpdatedAt: number;
  liveError: string | null;
  /** Provider health: capabilities, budget usage and the last failure. */
  liveDiagnostics: LiveDiagnostics | null;
};

const EMPTY: MarketSnapshot = {
  quotes: {},
  ready: false,
  lastTickAt: 0,
  source: "simulated",
  provider: "simulated",
  liveUpdatedAt: 0,
  liveError: null,
  liveDiagnostics: null,
};

const TICK_MS = 2200;
/**
 * Finnhub has no batch endpoint, so every symbol costs one call against a
 * ~60/min free budget. Instead of one big request, the board is refreshed in
 * rotating chunks: 12 symbols every ~15s ≈ 48 calls/min, which keeps the whole
 * catalog real-priced on a rolling minute without ever tripping the limit.
 */
const MAX_LIVE_SYMBOLS = 60;
const CHUNK_SIZE = 12;
const MIN_STEP_MS = 12_000;
const MAX_STEP_MS = 30_000;

let snapshot: MarketSnapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

/** User preference: should prices move at all? (`settings.livePrices`) */
let tickingEnabled = true;
/** Provider configuration resolved from `/api/market/config`. */
let providerEnabled = false;
let providerName = "simulated";
let pollMs = 45_000;

let baseSymbols: string[] = [];
const trackedSymbols = new Set<string>();
let lastPollAt = 0;
let pollStepMs = 15_000;
let chunkCursor = 0;
let primeNext = false;
let polling = false;

/** First poll after enabling live data covers the whole board at once. */
const PRIME_LIMIT = 48;

function emit() {
  for (const listener of Array.from(listeners)) listener();
}

function boot(): boolean {
  if (snapshot.ready) return false;
  const now = Date.now();
  snapshot = { ...snapshot, quotes: buildQuotes(now), ready: true, lastTickAt: now };
  return true;
}

/** Positions and watchlist first, then the catalog, then anything discovered. */
function prioritySymbols(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const list of [baseSymbols, Array.from(trackedSymbols), CATALOG.map((i) => i.symbol), dynamicSymbols()]) {
    for (const symbol of list) {
      const key = symbol?.toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }

  return out.slice(0, MAX_LIVE_SYMBOLS);
}

/** Next slice of the priority list — the cursor walks the whole board. */
function nextChunk(symbols: string[]): string[] {
  if (symbols.length <= CHUNK_SIZE) return symbols;
  if (chunkCursor >= symbols.length) chunkCursor = 0;
  const chunk = symbols.slice(chunkCursor, chunkCursor + CHUNK_SIZE);
  chunkCursor = (chunkCursor + CHUNK_SIZE) % symbols.length;
  return chunk;
}

async function pollLive() {
  if (polling || typeof window === "undefined") return;
  polling = true;

  try {
    // Never let a live poll mark the board ready before the simulated base
    // exists — otherwise symbols outside the first chunk would have no quote.
    boot();

    const symbols = prioritySymbols();
    if (symbols.length === 0) return;

    const batch = primeNext ? symbols.slice(0, PRIME_LIMIT) : nextChunk(symbols);
    primeNext = false;

    const response = await fetchLiveQuotes(batch);
    const now = Date.now();
    const diagnostics = response?.diagnostics ?? snapshot.liveDiagnostics;

    if (!response || !response.live) {
      snapshot = {
        ...snapshot,
        liveError: "Live market data is not enabled on the server.",
        liveDiagnostics: diagnostics,
      };
      emit();
      return;
    }

    const entries = Object.entries(response.quotes ?? {});

    if (entries.length === 0) {
      snapshot = {
        ...snapshot,
        liveError:
          diagnostics?.lastError?.message ??
          (response.missing?.length
            ? `The provider returned no quotes for ${response.missing.length} symbol(s) — those prices stay simulated.`
            : "The provider returned no quotes."),
        liveDiagnostics: diagnostics,
      };
      emit();
      return;
    }

    const quotes = { ...snapshot.quotes };
    for (const [symbol, liveQuote] of entries) {
      quotes[symbol] = mergeLiveQuote(symbol, liveQuote, quotes[symbol], now);
    }

    snapshot = {
      quotes,
      ready: true,
      lastTickAt: now,
      source: "live",
      provider: providerName,
      liveUpdatedAt: now,
      liveError: null,
      liveDiagnostics: diagnostics,
    };
    emit();
  } catch (error) {
    snapshot = {
      ...snapshot,
      liveError: error instanceof Error ? error.message : "Live quote update failed.",
    };
    emit();
  } finally {
    polling = false;
    lastPollAt = Date.now();
  }
}

function start() {
  if (timer !== null || typeof window === "undefined") return;

  timer = setInterval(() => {
    if (!snapshot.ready) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const now = Date.now();

    // Live mode: real prices only move when the provider says so, so the
    // simulated random walk is frozen between polls instead of drifting away
    // from the real quote.
    if (tickingEnabled && providerEnabled) {
      if (now - lastPollAt >= pollStepMs) void pollLive();
      return;
    }

    if (!tickingEnabled) return;

    snapshot = {
      quotes: tickQuotes(snapshot.quotes, now),
      ready: true,
      lastTickAt: now,
      source: "simulated",
      provider: "simulated",
      liveUpdatedAt: snapshot.liveUpdatedAt,
      liveError: snapshot.liveError,
      liveDiagnostics: snapshot.liveDiagnostics,
    };
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

  /** User setting: keep prices moving (simulated) or poll the provider (live). */
  setLive(enabled: boolean) {
    tickingEnabled = enabled;
    if (enabled && providerEnabled) lastPollAt = 0;
  },
  isLive() {
    return tickingEnabled;
  },

  /** Called by MarketProvider once `/api/market/config` resolves. */
  configureProvider(options: { enabled: boolean; provider: string; pollMs: number }) {
    providerEnabled = options.enabled;
    providerName = options.enabled ? options.provider : "simulated";
    pollMs = Math.max(15_000, options.pollMs);
    // Refresh a chunk several times per cache window so prices look alive.
    pollStepMs = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, Math.round(pollMs / 4)));

    if (providerEnabled && tickingEnabled && typeof window !== "undefined") {
      lastPollAt = 0;
      chunkCursor = 0;
      primeNext = true;
      void pollLive();
    } else if (!providerEnabled && snapshot.source === "live") {
      snapshot = { ...snapshot, source: "simulated", provider: "simulated", liveError: null };
      emit();
    }
  },

  /** Snapshot of provider health for the UI (budget, capabilities, errors). */
  getDiagnostics() {
    return snapshot.liveDiagnostics;
  },

  /** How many symbols currently carry a real provider price. */
  liveSymbolCount() {
    return Object.values(snapshot.quotes).filter((quote) => quote.source === "live").length;
  },

  /** Symbols that matter most (open positions + watchlist) — polled first. */
  setPrioritySymbols(symbols: string[]) {
    baseSymbols = symbols.map((symbol) => symbol.toUpperCase());
  },

  /** Ad-hoc tracking, e.g. a symbol opened from live search. */
  trackSymbol(symbol: string) {
    const key = symbol?.toUpperCase();
    if (!key) return;
    const isNew = !trackedSymbols.has(key);
    trackedSymbols.add(key);
    // A freshly opened symbol should be priced immediately, not in ~a minute.
    if (isNew && providerEnabled && tickingEnabled) primeNext = true;
    if (providerEnabled && tickingEnabled) {
      lastPollAt = 0;
      if (typeof window !== "undefined") void pollLive();
    }
  },

  /** Advance the board immediately (used when live ticking is paused). */
  step() {
    if (providerEnabled && tickingEnabled) {
      lastPollAt = 0;
      void pollLive();
      return;
    }

    if (!snapshot.ready) {
      boot();
      emit();
      return;
    }

    const now = Date.now();
    snapshot = {
      quotes: tickQuotes(snapshot.quotes, now),
      ready: true,
      lastTickAt: now,
      source: "simulated",
      provider: "simulated",
      liveUpdatedAt: snapshot.liveUpdatedAt,
      liveError: snapshot.liveError,
      liveDiagnostics: snapshot.liveDiagnostics,
    };
    emit();
  },
};

export function useMarketSnapshot(): MarketSnapshot {
  return useSyncExternalStore(marketStore.subscribe, marketStore.getSnapshot, marketStore.getServerSnapshot);
}
