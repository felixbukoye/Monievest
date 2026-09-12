import { gaussian, hashString, mulberry32, clamp } from "@/lib/utils";
import { CATALOG, INSTRUMENTS_BY_SYMBOL, getInstrument } from "./catalog";
import { getLiveCandles } from "./live-history";
import type { Candle, Instrument, Quote, Range } from "./types";

/**
 * ---------------------------------------------------------------------------
 * The Monievest market simulator
 * ---------------------------------------------------------------------------
 * Everything here is generated locally and deterministically from the ticker
 * symbol, so the same chart appears on every reload and no API key is needed.
 * Prices then drift in real time via `tickQuotes`, driven by a random walk
 * calibrated to each instrument's annualised volatility.
 */

const SESSION_OPEN_MINUTES = 9 * 60 + 30; // 09:30 ET
const TRADING_MINUTES = 390; // 6.5h

type RangeConfig = {
  points: number;
  stepMs: number;
  /** number of these bars in one trading year */
  barsPerYear: number;
  intraday: boolean;
};

const RANGE_CONFIG: Record<Range, RangeConfig> = {
  "1D": { points: 79, stepMs: 5 * 60 * 1000, barsPerYear: 252 * 78, intraday: true },
  "1W": { points: 66, stepMs: 30 * 60 * 1000, barsPerYear: 252 * 13, intraday: true },
  "1M": { points: 22, stepMs: 86_400_000, barsPerYear: 252, intraday: false },
  "3M": { points: 64, stepMs: 86_400_000, barsPerYear: 252, intraday: false },
  "6M": { points: 127, stepMs: 86_400_000, barsPerYear: 252, intraday: false },
  "1Y": { points: 252, stepMs: 86_400_000, barsPerYear: 252, intraday: false },
  "5Y": { points: 261, stepMs: 7 * 86_400_000, barsPerYear: 52, intraday: false },
};

/** Hand-tuned bias so growth names trend up and turnaround names trend down. */
function annualDrift(instrument: Instrument, rand: () => number): number {
  let drift = 0.07 + (rand() - 0.42) * 0.14;
  const tags = instrument.tags.join(" ").toLowerCase();
  if (/ai|high growth|cloud|growth/.test(tags)) drift += 0.14;
  if (/turnaround|speculative|high beta/.test(tags)) drift -= 0.07;
  if (instrument.pe === null) drift -= 0.06;
  if (instrument.kind === "etf") drift = clamp(drift, 0.05, 0.17);
  return drift;
}

/** Piecewise Brownian bridge: a random walk pinned to pass through anchors. */
function bridgePath(
  anchors: { index: number; value: number }[],
  sigmaStep: number,
  rand: () => number,
): number[] {
  const total = anchors[anchors.length - 1]!.index;
  const path: number[] = new Array(total + 1).fill(0);

  for (let a = 0; a < anchors.length - 1; a++) {
    const from = anchors[a]!;
    const to = anchors[a + 1]!;
    const n = to.index - from.index;
    if (n <= 0) continue;

    const walk: number[] = new Array(n + 1).fill(0);
    for (let k = 1; k <= n; k++) {
      walk[k] = walk[k - 1]! + gaussian(rand) * sigmaStep * from.value;
    }
    const walkEnd = walk[n]!;

    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const linear = from.value + (to.value - from.value) * t;
      const correction = walk[k]! - t * walkEnd;
      path[from.index + k] = Math.max(linear + correction * (1 - 0.25 * t), from.value * 0.05);
    }
  }
  return path;
}

function timestampsFor(config: RangeConfig, points: number, now: number): number[] {
  const out: number[] = [];
  if (config.intraday) {
    // Anchor the session to the most recent weekday so charts look current.
    const date = new Date(now);
    const day = date.getUTCDay();
    const offsetToFriday = day === 0 ? 2 : day === 6 ? 1 : 0;
    date.setUTCDate(date.getUTCDate() - offsetToFriday);
    const start = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      13, // 09:30 ET == 13:30 UTC (EDT)
      SESSION_OPEN_MINUTES % 60,
    );
    for (let i = 0; i < points; i++) out.push(start + i * config.stepMs);
  } else {
    const end = now - (now % 86_400_000);
    for (let i = points - 1; i >= 0; i--) out.push(end - i * config.stepMs);
  }
  return out;
}

function toCandles(closes: number[], timestamps: number[], instrument: Instrument, rand: () => number): Candle[] {
  const baseVol = instrument.avgVolume / closes.length;
  return closes.map((close, i) => {
    const open = i === 0 ? close * (1 - (rand() - 0.5) * 0.004) : closes[i - 1]!;
    const wick = Math.abs(gaussian(rand)) * instrument.volatility * 0.012 + 0.0006;
    const high = Math.max(open, close) * (1 + wick * rand());
    const low = Math.min(open, close) * (1 - wick * rand());
    const move = Math.abs(close - open) / Math.max(open, 1e-9);
    const v = Math.round(baseVol * (0.55 + rand() * 0.75 + move * 26));
    return { t: timestamps[i]!, o: open, h: high, l: low, c: close, v };
  });
}

const historyCache = new Map<string, Candle[]>();

/** Deterministic historical candles for an instrument over a given range. */
export function getHistory(instrument: Instrument, range: Range, now = Date.now()): Candle[] {
  // Real provider history takes precedence over the simulated series.
  const live = getLiveCandles(instrument.symbol, range);
  if (live && live.length > 1) return live;

  const key = `${instrument.symbol}:${range}:${now - (now % 3_600_000)}`;
  const cached = historyCache.get(key);
  if (cached) return cached;

  const config = RANGE_CONFIG[range];
  const seed = hashString(`${instrument.symbol}|${range}`);
  const rand = mulberry32(seed);
  const trend = mulberry32(hashString(`${instrument.symbol}|drift`));

  const points = config.points;
  const yearsSpan = (points - 1) / config.barsPerYear;
  const sigmaStep = instrument.volatility * Math.sqrt(yearsSpan / (points - 1));

  const end = instrument.price;
  const anchors: { index: number; value: number }[] = [];

  if (range === "1D") {
    const prevClose = end / (1 + instrument.changePct / 100);
    const openGap = prevClose * (1 + (rand() - 0.5) * 0.006);
    anchors.push({ index: 0, value: openGap });
    // lunch-hour lull + an afternoon move keeps the shape believable
    anchors.push({ index: Math.round(points * 0.45), value: openGap * (1 + (rand() - 0.5) * 0.008) });
    anchors.push({ index: points - 1, value: end });
  } else if (range === "1Y") {
    const span = instrument.week52High - instrument.week52Low;
    const start = instrument.week52Low + span * (0.2 + rand() * 0.55);
    const highIndex = Math.round(points * (0.25 + rand() * 0.7));
    const lowIndex = Math.round(points * (0.05 + rand() * 0.9));
    anchors.push({ index: 0, value: start });
    if (highIndex < lowIndex) {
      anchors.push({ index: highIndex, value: instrument.week52High });
      anchors.push({ index: lowIndex, value: instrument.week52Low });
    } else {
      anchors.push({ index: lowIndex, value: instrument.week52Low });
      anchors.push({ index: highIndex, value: instrument.week52High });
    }
    anchors.push({ index: points - 1, value: end });
  } else {
    const drift = annualDrift(instrument, trend);
    const totalReturn = Math.exp(drift * yearsSpan) - 1;
    const bounded = clamp(totalReturn, -0.72, 6.5);
    const start = end / (1 + bounded);
    anchors.push({ index: 0, value: start });
    if (points > 40) {
      const mid = Math.round(points * 0.5);
      const midValue = start * (1 + bounded * 0.5) * (1 + (rand() - 0.5) * 0.12);
      anchors.push({ index: mid, value: midValue });
    }
    anchors.push({ index: points - 1, value: end });
  }

  anchors.sort((a, b) => a.index - b.index);
  const closes = bridgePath(anchors, sigmaStep, rand);
  const timestamps = timestampsFor(config, points, now);
  const candles = toCandles(closes, timestamps, instrument, rand);

  // Wicks are generated around the close path, so on the 1Y range they can
  // overshoot the published 52-week extremes. Clamp so the chart never
  // contradicts the "52-week range" statistic shown beside it.
  if (range === "1Y") {
    for (const candle of candles) {
      candle.h = Math.min(candle.h, instrument.week52High);
      candle.l = Math.max(candle.l, instrument.week52Low);
      candle.o = Math.min(Math.max(candle.o, candle.l), candle.h);
      candle.c = Math.min(Math.max(candle.c, candle.l), candle.h);
    }
    const lastCandle = candles[candles.length - 1]!;
    lastCandle.c = instrument.price;
  }

  historyCache.set(key, candles);
  if (historyCache.size > 400) {
    const oldest = historyCache.keys().next().value;
    if (oldest) historyCache.delete(oldest);
  }
  return candles;
}

export function getHistoryBySymbol(symbol: string, range: Range, now = Date.now()): Candle[] {
  const key = symbol.toUpperCase();
  const instrument = INSTRUMENTS_BY_SYMBOL[key] ?? getInstrument(key);
  if (!instrument) return [];
  return getHistory(instrument, range, now);
}

/** Deterministic previous close implied by the catalogued daily move. */
export function previousCloseOf(instrument: Instrument): number {
  return instrument.price / (1 + instrument.changePct / 100);
}

function buildIntraday(instrument: Instrument, now: number): { t: number; p: number }[] {
  const candles = getHistory(instrument, "1D", now);
  return candles.map((c) => ({ t: c.t, p: c.c }));
}

/** Build the full quote board once, at boot. */
export function buildQuotes(now = Date.now()): Record<string, Quote> {
  const quotes: Record<string, Quote> = {};
  for (const instrument of CATALOG) {
    const rand = mulberry32(hashString(`${instrument.symbol}|quote`));
    const prevClose = previousCloseOf(instrument);
    const intraday = buildIntraday(instrument, now);
    const prices = intraday.map((p) => p.p);
    const open = prices[0] ?? prevClose;
    quotes[instrument.symbol] = {
      symbol: instrument.symbol,
      price: instrument.price,
      open,
      prevClose,
      change: instrument.price - prevClose,
      changePct: instrument.changePct,
      dayHigh: Math.max(...prices, instrument.price),
      dayLow: Math.min(...prices, instrument.price),
      volume: Math.round(instrument.avgVolume * (0.45 + rand() * 0.85)),
      updatedAt: now,
      direction: "flat",
      intraday,
      source: "simulated",
    };
  }
  return quotes;
}

const MAX_INTRADAY_POINTS = 180;

/**
 * Advance the whole board one step. Called on an interval by MarketProvider.
 * Returns a new object so React sees the change.
 */
export function tickQuotes(
  quotes: Record<string, Quote>,
  now = Date.now(),
  opts?: { speed?: number },
): Record<string, Quote> {
  const speed = opts?.speed ?? 1;
  const next: Record<string, Quote> = {};

  // Occasionally one name gets a "headline" move so the board feels alive.
  const symbols = Object.keys(quotes);
  const headlineSymbol =
    Math.random() < 0.16 ? symbols[Math.floor(Math.random() * symbols.length)] : undefined;

  for (const symbol of symbols) {
    const quote = quotes[symbol]!;
    const instrument = INSTRUMENTS_BY_SYMBOL[symbol];
    if (!instrument) {
      next[symbol] = quote;
      continue;
    }

    // Per-tick sigma: roughly 1/200th of a trading day's standard deviation.
    const sigma = (instrument.volatility / Math.sqrt(252)) / 22;
    let shock = gaussian(Math.random) * sigma * speed;
    if (symbol === headlineSymbol) shock += (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.009);

    // Mean reversion keeps the board anchored near its catalogued reference.
    const deviation = Math.log(quote.price / instrument.price);
    shock -= deviation * 0.045;

    const price = Math.max(quote.price * (1 + shock), 0.5);
    const direction: Quote["direction"] =
      price > quote.price + 1e-9 ? "up" : price < quote.price - 1e-9 ? "down" : "flat";

    const intraday = [...quote.intraday, { t: now, p: price }];
    if (intraday.length > MAX_INTRADAY_POINTS) intraday.splice(0, intraday.length - MAX_INTRADAY_POINTS);

    next[symbol] = {
      ...quote,
      price,
      change: price - quote.prevClose,
      changePct: ((price - quote.prevClose) / quote.prevClose) * 100,
      dayHigh: Math.max(quote.dayHigh, price),
      dayLow: Math.min(quote.dayLow, price),
      volume: quote.volume + Math.round(instrument.avgVolume * 0.0016 * (0.4 + Math.random())),
      updatedAt: now,
      direction,
      intraday,
      source: "simulated",
    };
  }
  return next;
}

/** Indices synthesised from the board so the dashboard has headline numbers. */
export type IndexQuote = {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePct: number;
  spark: number[];
};

export function buildIndices(quotes: Record<string, Quote>): IndexQuote[] {
  const definitions = [
    { symbol: "SPX", name: "S&P 500", proxy: "SPY", base: 6452.18 },
    { symbol: "NDX", name: "Nasdaq 100", proxy: "QQQ", base: 23418.6 },
    { symbol: "DJI", name: "Dow Jones", proxy: "JPM", base: 45120.4 },
    { symbol: "RUT", name: "Russell 2000", proxy: "VTI", base: 2284.9 },
    { symbol: "VIX", name: "Volatility", proxy: "ARKK", base: 15.42 },
  ];

  return definitions.map((definition) => {
    const proxy = quotes[definition.proxy];
    const instrument = INSTRUMENTS_BY_SYMBOL[definition.proxy]!;
    const changePct = proxy ? proxy.changePct * (definition.symbol === "VIX" ? -1.6 : 1) : instrument.changePct;
    const value = definition.base * (1 + changePct / 100);
    const rand = mulberry32(hashString(definition.symbol));
    const spark = Array.from({ length: 48 }, (_, i) => {
      const t = i / 47;
      return definition.base * (1 + (rand() - 0.5) * 0.004 + t * (changePct / 100));
    });
    return {
      symbol: definition.symbol,
      name: definition.name,
      value,
      change: value - definition.base,
      changePct,
      spark,
    };
  });
}

/** Is the real US cash equity market open right now? (Used for the status badge.) */
export function marketSession(now = new Date()): {
  open: boolean;
  label: string;
  phase: "pre" | "open" | "post" | "closed";
} {
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => et.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekend = weekday === "Sat" || weekday === "Sun";
  const minutes = hour * 60 + minute;

  if (weekend) return { open: false, label: "Closed · weekend", phase: "closed" };
  if (minutes < SESSION_OPEN_MINUTES - 120) return { open: false, label: "Closed · pre-market", phase: "pre" };
  if (minutes < SESSION_OPEN_MINUTES) return { open: false, label: "Pre-market", phase: "pre" };
  if (minutes < SESSION_OPEN_MINUTES + TRADING_MINUTES) return { open: true, label: "Market open", phase: "open" };
  if (minutes < SESSION_OPEN_MINUTES + TRADING_MINUTES + 120)
    return { open: false, label: "After hours", phase: "post" };
  return { open: false, label: "Closed · after hours", phase: "closed" };
}
