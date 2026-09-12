import type { Instrument } from "./types";

/**
 * ---------------------------------------------------------------------------
 * Dynamic instrument registry
 * ---------------------------------------------------------------------------
 * The curated catalog in `catalog.ts` is static and ships 44 instruments. When
 * live provider data is enabled the app can reach the whole listed universe, so
 * instruments discovered at runtime (search hits, deep links resolved on the
 * server) are registered here.
 *
 * Isomorphic and side-effect free at import time: on the server it stays empty
 * unless a request explicitly populates it, and on the client it grows as the
 * user searches. `getInstrument()` in the catalog consults it as a fallback.
 */

const registry = new Map<string, Instrument>();

export function registerInstrument(instrument: Instrument): Instrument {
  const key = instrument.symbol.toUpperCase();
  const existing = registry.get(key);
  // Keep the richer record: a resolved profile beats a bare search hit.
  if (existing && existing.price > 0 && !(instrument.price > 0)) return existing;
  const merged = existing ? { ...existing, ...instrument, price: instrument.price || existing.price } : instrument;
  registry.set(key, merged);
  return merged;
}

export function registerInstruments(instruments: Instrument[]): void {
  for (const instrument of instruments) registerInstrument(instrument);
}

export function getDynamicInstrument(symbol: string): Instrument | undefined {
  return registry.get(symbol?.toUpperCase());
}

export function dynamicInstruments(): Instrument[] {
  return Array.from(registry.values());
}

export function dynamicSymbols(): string[] {
  return Array.from(registry.keys());
}

export function registrySize(): number {
  return registry.size;
}
