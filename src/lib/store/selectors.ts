import { CATALOG, getInstrument } from "@/lib/market/catalog";
import { getHistory } from "@/lib/market/engine";
import type { Instrument, Quote, Range } from "@/lib/market/types";
import type { PortfolioState } from "./types";

/** Percentage move over a historical window, ending at the live price. */
export function periodChangePct(
  instrument: Instrument,
  quote: Quote | undefined,
  range: Range = "1M",
): number {
  const candles = getHistory(instrument, range);
  const first = candles[0]?.c;
  const price = quote?.price ?? instrument.price;
  if (!first) return instrument.changePct;
  return ((price - first) / first) * 100;
}

export type Holding = {
  instrument: Instrument;
  quote: Quote | undefined;
  qty: number;
  avgCost: number;
  price: number;
  marketValue: number;
  costBasis: number;
  dayChange: number;
  dayChangePct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  weight: number;
  spark: number[];
};

export type PortfolioSummary = {
  cash: number;
  invested: number;
  marketValue: number;
  totalValue: number;
  dayChange: number;
  dayChangePct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  netContributions: number;
  totalReturn: number;
  totalReturnPct: number;
  pendingOrders: number;
  positionCount: number;
};

export function priceOf(quote: Quote | undefined, instrument: Instrument): number {
  return quote?.price ?? instrument.price;
}

/** Net money the user has put in (deposits − withdrawals, dividends counted as income). */
export function netContributions(state: PortfolioState): number {
  return state.activity.reduce((acc, entry) => {
    if (entry.type === "withdraw" || entry.type === "deposit") return acc + entry.amount;
    if (entry.type === "dividend") return acc + entry.amount;
    return acc;
  }, 0);
}

export function buildHoldings(state: PortfolioState, quotes: Record<string, Quote>): Holding[] {
  const holdings: Holding[] = [];

  for (const position of state.positions) {
    const instrument = getInstrument(position.symbol);
    if (!instrument) continue;

    const quote = quotes[position.symbol];
    const price = priceOf(quote, instrument);
    const marketValue = position.qty * price;
    const costBasis = position.qty * position.avgCost;
    const prevClose = quote?.prevClose ?? instrument.price / (1 + instrument.changePct / 100);
    const spark =
      quote && quote.intraday.length > 1
        ? quote.intraday.map((point) => point.p)
        : getHistory(instrument, "1D").map((candle) => candle.c);

    holdings.push({
      instrument,
      quote,
      qty: position.qty,
      avgCost: position.avgCost,
      price,
      marketValue,
      costBasis,
      dayChange: (price - prevClose) * position.qty,
      dayChangePct: ((price - prevClose) / prevClose) * 100,
      unrealizedPnl: marketValue - costBasis,
      unrealizedPnlPct: costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0,
      weight: 0,
      spark,
    });
  }

  const investedTotal = holdings.reduce((acc, holding) => acc + holding.marketValue, 0);
  for (const holding of holdings) {
    holding.weight = investedTotal > 0 ? (holding.marketValue / investedTotal) * 100 : 0;
  }

  return holdings.sort((a, b) => b.marketValue - a.marketValue);
}

export function summarise(state: PortfolioState, quotes: Record<string, Quote>): PortfolioSummary {
  const holdings = buildHoldings(state, quotes);
  const marketValue = holdings.reduce((acc, h) => acc + h.marketValue, 0);
  const invested = holdings.reduce((acc, h) => acc + h.costBasis, 0);
  const dayChange = holdings.reduce((acc, h) => acc + h.dayChange, 0);
  const prevValue = marketValue - dayChange;
  const totalValue = marketValue + state.cash;
  const contributions = netContributions(state);

  return {
    cash: state.cash,
    invested,
    marketValue,
    totalValue,
    dayChange,
    dayChangePct: prevValue > 0 ? (dayChange / prevValue) * 100 : 0,
    unrealizedPnl: marketValue - invested,
    unrealizedPnlPct: invested > 0 ? ((marketValue - invested) / invested) * 100 : 0,
    realizedPnl: state.realizedPnl,
    netContributions: contributions,
    totalReturn: totalValue - contributions,
    totalReturnPct: contributions > 0 ? ((totalValue - contributions) / contributions) * 100 : 0,
    pendingOrders: state.orders.filter((o) => o.status === "pending").length,
    positionCount: holdings.length,
  };
}

export type AllocationSlice = {
  key: string;
  label: string;
  value: number;
  weight: number;
  color: string;
};

export function allocationBy(holdings: Holding[], key: "sector" | "symbol"): AllocationSlice[] {
  const map = new Map<string, { value: number; color: string; label: string }>();
  for (const holding of holdings) {
    const id = key === "sector" ? holding.instrument.sector : holding.instrument.symbol;
    const label = key === "sector" ? holding.instrument.sector : holding.instrument.name;
    const entry = map.get(id) ?? { value: 0, color: holding.instrument.color, label };
    entry.value += holding.marketValue;
    map.set(id, entry);
  }
  const total = Array.from(map.values()).reduce((acc, e) => acc + e.value, 0) || 1;
  return Array.from(map.entries())
    .map(([id, entry]) => ({
      key: id,
      label: entry.label,
      value: entry.value,
      weight: (entry.value / total) * 100,
      color: entry.color,
    }))
    .sort((a, b) => b.value - a.value);
}

export type PerformancePoint = { t: number; value: number; benchmark?: number };

const performanceCache = new Map<string, PerformancePoint[]>();

/**
 * Replays the cash ledger and share ledger against simulated history to
 * reconstruct what the portfolio was worth at each point in the window.
 */
export function buildPerformance(
  state: PortfolioState,
  range: Range,
  withBenchmark = true,
): PerformancePoint[] {
  const signature = `${range}:${withBenchmark}:${state.activity.length}:${state.activity[0]?.createdAt ?? 0}:${state.cash.toFixed(2)}`;
  const cached = performanceCache.get(signature);
  if (cached) return cached;

  const anchor = getInstrument("SPY")!;
  const timeline = getHistory(anchor, range);
  if (timeline.length === 0) return [];

  // Ledger entries sorted oldest → newest.
  const ledger = [...state.activity]
    .filter((entry) => entry.type !== "cancel")
    .sort((a, b) => a.createdAt - b.createdAt);

  const priceMaps = new Map<string, { ts: number[]; closes: number[] }>();
  const priceAt = (symbol: string, index: number, t: number): number => {
    let map = priceMaps.get(symbol);
    if (!map) {
      const instrument = getInstrument(symbol);
      if (!instrument) return 0;
      const candles = getHistory(instrument, range);
      map = { ts: candles.map((c) => c.t), closes: candles.map((c) => c.c) };
      priceMaps.set(symbol, map);
    }
    if (index >= 0 && index < map.closes.length) return map.closes[index]!;
    // fall back to nearest earlier timestamp
    let lo = 0;
    for (let i = 0; i < map.ts.length; i++) {
      if (map.ts[i]! <= t) lo = i;
      else break;
    }
    return map.closes[lo] ?? map.closes[map.closes.length - 1] ?? 0;
  };

  const shares = new Map<string, number>();
  let cash = 0;
  let cursor = 0;

  const benchmarkStart = withBenchmark ? (timeline[0]?.c ?? 1) : 1;
  const out: PerformancePoint[] = [];
  let startValue = 0;

  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i]!.t;
    while (cursor < ledger.length && ledger[cursor]!.createdAt <= t) {
      const entry = ledger[cursor]!;
      cash += entry.amount;
      if (entry.symbol && entry.qty && (entry.type === "buy" || entry.type === "sell")) {
        const delta = entry.type === "buy" ? entry.qty : -entry.qty;
        shares.set(entry.symbol, (shares.get(entry.symbol) ?? 0) + delta);
      }
      cursor++;
    }

    let value = cash;
    for (const [symbol, qty] of shares) {
      if (qty <= 1e-9) continue;
      value += qty * priceAt(symbol, i, t);
    }

    if (i === 0) startValue = value;
    out.push({
      t,
      value,
      benchmark: withBenchmark ? (timeline[i]!.c / benchmarkStart) * startValue : undefined,
    });
  }

  performanceCache.set(signature, out);
  if (performanceCache.size > 40) {
    const oldest = performanceCache.keys().next().value;
    if (oldest) performanceCache.delete(oldest);
  }
  return out;
}

export type Mover = { instrument: Instrument; quote: Quote };

export function topMovers(quotes: Record<string, Quote>): {
  gainers: Mover[];
  losers: Mover[];
  active: Mover[];
} {
  const rows: Mover[] = CATALOG.map((instrument) => ({ instrument, quote: quotes[instrument.symbol]! })).filter(
    (row) => row.quote,
  );

  const gainers = [...rows].sort((a, b) => b.quote.changePct - a.quote.changePct).slice(0, 6);
  const losers = [...rows].sort((a, b) => a.quote.changePct - b.quote.changePct).slice(0, 6);
  const active = [...rows]
    .sort((a, b) => (b.quote.volume * b.quote.price) / b.instrument.marketCap - (a.quote.volume * a.quote.price) / a.instrument.marketCap)
    .slice(0, 6);

  return { gainers, losers, active };
}

export function searchInstruments(query: string, limit = 8): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.slice(0, limit);
  const scored = CATALOG.map((instrument) => {
    const symbol = instrument.symbol.toLowerCase();
    const name = instrument.name.toLowerCase();
    let score = 0;
    if (symbol === q) score = 100;
    else if (symbol.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 70;
    else if (symbol.includes(q)) score = 55;
    else if (name.includes(q)) score = 45;
    else if (instrument.sector.toLowerCase().includes(q)) score = 25;
    else if (instrument.tags.some((tag) => tag.toLowerCase().includes(q))) score = 20;
    return { instrument, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.instrument.symbol.localeCompare(b.instrument.symbol));
  return scored.slice(0, limit).map((row) => row.instrument);
}
