import { uniqueId } from "@/lib/utils";
import type { Activity, Order, PortfolioState, Position, Settings } from "./types";
import { STATE_VERSION } from "./types";

const DAY = 86_400_000;

type Lot = { symbol: string; qty: number; price: number; daysAgo: number };

/** Buy lots that make up the seeded demo portfolio. */
const SEED_BUYS: Lot[] = [
  { symbol: "AAPL", qty: 24, price: 178.42, daysAgo: 402 },
  { symbol: "AAPL", qty: 18, price: 196.85, daysAgo: 138 },
  { symbol: "MSFT", qty: 12, price: 351.2, daysAgo: 356 },
  { symbol: "MSFT", qty: 6, price: 414.6, daysAgo: 96 },
  { symbol: "NVDA", qty: 40, price: 74.18, daysAgo: 318 },
  { symbol: "NVDA", qty: 25, price: 121.44, daysAgo: 61 },
  { symbol: "SPY", qty: 12, price: 512.33, daysAgo: 430 },
  { symbol: "VTI", qty: 20, price: 244.15, daysAgo: 288 },
  { symbol: "QQQ", qty: 8, price: 431.72, daysAgo: 214 },
  { symbol: "JPM", qty: 15, price: 186.4, daysAgo: 176 },
  { symbol: "LLY", qty: 3, price: 684.2, daysAgo: 152 },
  { symbol: "KO", qty: 40, price: 61.85, daysAgo: 118 },
  { symbol: "TSLA", qty: 10, price: 189.3, daysAgo: 74 },
  // Closed out — these feed realised P&L and the activity feed.
  { symbol: "NFLX", qty: 4, price: 482.6, daysAgo: 265 },
  { symbol: "INTC", qty: 100, price: 31.8, daysAgo: 240 },
];

const SEED_SELLS: Lot[] = [
  { symbol: "NFLX", qty: 4, price: 641.9, daysAgo: 88 },
  { symbol: "INTC", qty: 100, price: 24.12, daysAgo: 54 },
];

const SEED_DEPOSITS = [
  { amount: 50_000, daysAgo: 445, note: "ACH transfer · Chase ••4417" },
  { amount: 18_000, daysAgo: 231, note: "ACH transfer · Chase ••4417" },
  { amount: 12_000, daysAgo: 47, note: "Instant deposit · Visa ••9021" },
];

const SEED_WATCHLIST = ["PLTR", "COIN", "AMD", "ARKK", "GOOGL", "COST", "AVGO"];

export const DEFAULT_SETTINGS: Settings = {
  livePrices: true,
  autoFillLimits: true,
  compactTables: false,
  defaultRange: "1M",
};

/**
 * Build the demo account. Cash is derived from the ledger so the seeded
 * numbers always reconcile: deposits − buys + sells.
 */
export function createSeedState(now = Date.now()): PortfolioState {
  const orders: Order[] = [];
  const activity: Activity[] = [];
  const positionMap = new Map<string, Position>();

  for (const lot of SEED_BUYS) {
    const orderId = uniqueId("ord");
    const createdAt = now - lot.daysAgo * DAY;
    const notional = lot.qty * lot.price;

    orders.push({
      id: orderId,
      symbol: lot.symbol,
      side: "buy",
      type: lot.daysAgo < 30 ? "market" : Math.random() < 0.35 ? "limit" : "market",
      qty: lot.qty,
      limitPrice: null,
      filledPrice: lot.price,
      notional,
      status: "filled",
      createdAt,
      filledAt: createdAt,
    });

    activity.push({
      id: uniqueId("act"),
      type: "buy",
      symbol: lot.symbol,
      qty: lot.qty,
      price: lot.price,
      amount: -notional,
      createdAt,
      orderId,
    });

    const existing = positionMap.get(lot.symbol);
    if (existing) {
      const totalQty = existing.qty + lot.qty;
      existing.avgCost = (existing.avgCost * existing.qty + lot.price * lot.qty) / totalQty;
      existing.qty = totalQty;
      existing.openedAt = Math.min(existing.openedAt, createdAt);
    } else {
      positionMap.set(lot.symbol, {
        symbol: lot.symbol,
        qty: lot.qty,
        avgCost: lot.price,
        openedAt: createdAt,
      });
    }
  }

  let realized = 0;
  for (const lot of SEED_SELLS) {
    const position = positionMap.get(lot.symbol);
    const costBasis = position?.avgCost ?? lot.price;
    const proceeds = lot.qty * lot.price;
    realized += (lot.price - costBasis) * lot.qty;
    positionMap.delete(lot.symbol);

    const orderId = uniqueId("ord");
    const createdAt = now - lot.daysAgo * DAY;
    orders.push({
      id: orderId,
      symbol: lot.symbol,
      side: "sell",
      type: "limit",
      qty: lot.qty,
      limitPrice: lot.price,
      filledPrice: lot.price,
      notional: proceeds,
      status: "filled",
      createdAt,
      filledAt: createdAt,
    });
    activity.push({
      id: uniqueId("act"),
      type: "sell",
      symbol: lot.symbol,
      qty: lot.qty,
      price: lot.price,
      amount: proceeds,
      createdAt,
      orderId,
      note: `Closed position · realised ${(lot.price - costBasis) >= 0 ? "+" : "−"}$${Math.abs(
        (lot.price - costBasis) * lot.qty,
      ).toFixed(2)}`,
    });
  }

  // Two live limit orders sitting on the book, so the pending state is visible.
  const pending: Order[] = [
    {
      id: uniqueId("ord"),
      symbol: "GOOGL",
      side: "buy",
      type: "limit",
      qty: 6,
      limitPrice: 172.5,
      filledPrice: null,
      notional: 6 * 172.5,
      status: "pending",
      createdAt: now - 2 * DAY,
      filledAt: null,
    },
    {
      id: uniqueId("ord"),
      symbol: "NVDA",
      side: "buy",
      type: "limit",
      qty: 12,
      limitPrice: 131.25,
      filledPrice: null,
      notional: 12 * 131.25,
      status: "pending",
      createdAt: now - 5 * 3_600_000,
      filledAt: null,
    },
  ];

  for (const deposit of SEED_DEPOSITS) {
    activity.push({
      id: uniqueId("act"),
      type: "deposit",
      amount: deposit.amount,
      createdAt: now - deposit.daysAgo * DAY,
      note: deposit.note,
    });
  }

  activity.push({
    id: uniqueId("act"),
    type: "dividend",
    amount: 128.44,
    createdAt: now - 21 * DAY,
    note: "Quarterly dividends · AAPL, MSFT, KO, JPM, SPY",
  });

  const invested = SEED_BUYS.reduce((acc, lot) => acc + lot.qty * lot.price, 0);
  const soldProceeds = SEED_SELLS.reduce((acc, lot) => acc + lot.qty * lot.price, 0);
  const deposited = SEED_DEPOSITS.reduce((acc, d) => acc + d.amount, 0);
  const cash = deposited - invested + soldProceeds + 128.44;

  activity.sort((a, b) => b.createdAt - a.createdAt);
  orders.sort((a, b) => b.createdAt - a.createdAt);

  return {
    version: STATE_VERSION,
    account: {
      name: "Demo Investor",
      email: "demo@monievest.app",
      tier: "Monievest Plus",
      accountNumber: "MV-4417-9021",
      joinedAt: now - 445 * DAY,
    },
    cash,
    realizedPnl: realized,
    positions: Array.from(positionMap.values()).sort((a, b) => b.qty * b.avgCost - a.qty * a.avgCost),
    orders: [...pending, ...orders],
    activity,
    watchlist: SEED_WATCHLIST,
    settings: { ...DEFAULT_SETTINGS },
  };
}
