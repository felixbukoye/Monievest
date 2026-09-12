export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "filled" | "pending" | "cancelled";

export type Order = {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limitPrice: number | null;
  filledPrice: number | null;
  notional: number;
  status: OrderStatus;
  createdAt: number;
  filledAt: number | null;
};

export type ActivityType =
  | "buy"
  | "sell"
  | "deposit"
  | "withdraw"
  | "cancel"
  | "dividend"
  | "fee";

export type Activity = {
  id: string;
  type: ActivityType;
  symbol?: string;
  qty?: number;
  price?: number;
  /** Signed impact on cash. */
  amount: number;
  createdAt: number;
  note?: string;
  orderId?: string;
};

export type Position = {
  symbol: string;
  qty: number;
  avgCost: number;
  openedAt: number;
};

export type Account = {
  name: string;
  email: string;
  tier: string;
  accountNumber: string;
  joinedAt: number;
};

export type Settings = {
  /** Keep the simulated price engine ticking. */
  livePrices: boolean;
  /** Fill pending limit orders automatically when the price is hit. */
  autoFillLimits: boolean;
  /** Denser tables and tighter spacing. */
  compactTables: boolean;
  /** Default chart range on stock pages. */
  defaultRange: "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";
};

export type PortfolioState = {
  version: number;
  account: Account;
  cash: number;
  realizedPnl: number;
  positions: Position[];
  orders: Order[];
  activity: Activity[];
  watchlist: string[];
  settings: Settings;
};

export type PlaceOrderPayload = {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limitPrice: number | null;
  marketPrice: number;
  at?: number;
};

export type Action =
  | { type: "place-order"; payload: PlaceOrderPayload }
  | { type: "fill-order"; payload: { id: string; price: number; at?: number } }
  | { type: "cancel-order"; payload: { id: string } }
  | { type: "deposit"; payload: { amount: number; method?: string } }
  | { type: "withdraw"; payload: { amount: number } }
  | { type: "toggle-watchlist"; payload: { symbol: string } }
  | { type: "update-settings"; payload: Partial<Settings> }
  | { type: "update-account"; payload: Partial<Account> }
  | { type: "replace-state"; payload: PortfolioState }
  | { type: "reset" };

export const STORAGE_KEY = "monievest.portfolio.v1";

/**
 * Per-user local cache key. Signed-in users get their own slot so two accounts
 * on one browser never overwrite each other; guests keep the original key.
 */
export function storageKeyFor(userId?: string | null): string {
  return userId ? `${STORAGE_KEY}:u:${userId}` : STORAGE_KEY;
}
export const STATE_VERSION = 1;
