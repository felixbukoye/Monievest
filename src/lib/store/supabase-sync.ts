import type { SupabaseClient } from "@supabase/supabase-js";

import { STARTING_CASH } from "./seed";
import {
  STATE_VERSION,
  type Activity,
  type ActivityType,
  type Order,
  type OrderSide,
  type OrderStatus,
  type OrderType,
  type PortfolioState,
  type Position,
} from "./types";

/**
 * Postgres ↔ app-state mapping for a signed-in user.
 *
 * Row Level Security scopes every query to `auth.uid()`, so these helpers never
 * send a `user_id` filter that could widen the result set — the database would
 * reject it anyway. Money arrives as `numeric` (string or number depending on
 * the driver) and timestamps as ISO strings; the app uses epoch millis, so both
 * are converted here at the boundary.
 */

export type SyncResult = { ok: boolean; error?: string };

export type LoadResult =
  | { status: "ok"; state: PortfolioState }
  /** Signed in, but no portfolio row yet (e.g. the bootstrap trigger hasn't run). */
  | { status: "empty" }
  | { status: "error"; error: string };

type ProfileRow = {
  display_name: string | null;
  tier: string | null;
  account_number: string | null;
  created_at: string | number | null;
};

type PortfolioRow = {
  cash: string | number | null;
  realized_pnl: string | number | null;
  state_version: number | null;
};

type PositionRow = {
  symbol: string;
  qty: string | number;
  avg_cost: string | number;
  opened_at: string | number | null;
};

type OrderRow = {
  id: string;
  symbol: string;
  side: string;
  type: string;
  qty: string | number;
  limit_price: string | number | null;
  filled_price: string | number | null;
  notional: string | number | null;
  status: string;
  created_at: string | number | null;
  filled_at: string | number | null;
};

type ActivityRow = {
  id: string;
  type: string;
  symbol: string | null;
  qty: string | number | null;
  price: string | number | null;
  amount: string | number | null;
  note: string | null;
  order_id: string | null;
  created_at: string | number | null;
};

type WatchlistRow = { symbol: string; created_at: string | number | null };

/** Rows are capped so a long-lived account can't fetch the whole ledger. */
const MAX_ORDERS = 500;
const MAX_ACTIVITY = 1000;
const UPSERT_CHUNK = 200;

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toMillis(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toIso(millis: number): string {
  return new Date(Number.isFinite(millis) ? millis : Date.now()).toISOString();
}

function inFilter(values: string[]): string {
  return `(${values.map((value) => `"${value.replace(/"/g, "")}"`).join(",")})`;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return items.length ? [items] : [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function firstError(...results: { error: { message: string } | null }[]): string | null {
  for (const result of results) {
    if (result.error) return result.error.message;
  }
  return null;
}

/** Activity ids already written for a user, so pushes only send new entries. */
const syncedActivity = new Map<string, Set<string>>();

export function forgetSyncCache(userId: string): void {
  syncedActivity.delete(userId);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function loadPortfolio(
  client: SupabaseClient,
  userId: string,
  email: string,
): Promise<LoadResult> {
  const [profile, portfolio, positions, orders, activity, watchlist] = await Promise.all([
    client
      .from("profiles")
      .select("display_name,tier,account_number,created_at")
      .eq("id", userId)
      .maybeSingle<ProfileRow>(),
    client
      .from("portfolios")
      .select("cash,realized_pnl,state_version")
      .eq("user_id", userId)
      .maybeSingle<PortfolioRow>(),
    client.from("positions").select("symbol,qty,avg_cost,opened_at").eq("user_id", userId).returns<PositionRow[]>(),
    client
      .from("orders")
      .select("id,symbol,side,type,qty,limit_price,filled_price,notional,status,created_at,filled_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ORDERS)
      .returns<OrderRow[]>(),
    client
      .from("activity")
      .select("id,type,symbol,qty,price,amount,note,order_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ACTIVITY)
      .returns<ActivityRow[]>(),
    client
      .from("watchlist")
      .select("symbol,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<WatchlistRow[]>(),
  ]);

  const error = firstError(profile, portfolio, positions, orders, activity, watchlist);
  if (error) return { status: "error", error };
  if (!portfolio.data) return { status: "empty" };

  const now = Date.now();
  const profileRow = profile.data;

  const mappedPositions: Position[] = (positions.data ?? []).map((row) => ({
    symbol: row.symbol,
    qty: toNumber(row.qty),
    avgCost: toNumber(row.avg_cost),
    openedAt: toMillis(row.opened_at, now),
  }));

  const mappedOrders: Order[] = (orders.data ?? []).map((row) => ({
    id: row.id,
    symbol: row.symbol,
    side: (row.side === "sell" ? "sell" : "buy") as OrderSide,
    type: (row.type === "limit" ? "limit" : "market") as OrderType,
    qty: toNumber(row.qty),
    limitPrice: row.limit_price === null ? null : toNumber(row.limit_price),
    filledPrice: row.filled_price === null ? null : toNumber(row.filled_price),
    notional: toNumber(row.notional),
    status: (["filled", "pending", "cancelled"].includes(row.status) ? row.status : "filled") as OrderStatus,
    createdAt: toMillis(row.created_at, now),
    filledAt: row.filled_at === null ? null : toMillis(row.filled_at, now),
  }));

  const mappedActivity: Activity[] = (activity.data ?? []).map((row) => {
    const entry: Activity = {
      id: row.id,
      type: row.type as ActivityType,
      amount: toNumber(row.amount),
      createdAt: toMillis(row.created_at, now),
    };
    if (row.symbol) entry.symbol = row.symbol;
    if (row.qty !== null) entry.qty = toNumber(row.qty);
    if (row.price !== null) entry.price = toNumber(row.price);
    if (row.note) entry.note = row.note;
    if (row.order_id) entry.orderId = row.order_id;
    return entry;
  });

  return {
    status: "ok",
    state: {
      version: STATE_VERSION,
      account: {
        name: profileRow?.display_name || email.split("@")[0] || "Investor",
        email,
        tier: profileRow?.tier || "Monievest Plus",
        accountNumber: profileRow?.account_number || `MV-${userId.slice(0, 8).toUpperCase()}`,
        joinedAt: toMillis(profileRow?.created_at, now),
      },
      cash: toNumber(portfolio.data.cash),
      realizedPnl: toNumber(portfolio.data.realized_pnl),
      positions: mappedPositions.sort((a, b) => b.qty * b.avgCost - a.qty * a.avgCost),
      orders: mappedOrders.sort((a, b) => b.createdAt - a.createdAt),
      activity: mappedActivity.sort((a, b) => b.createdAt - a.createdAt),
      watchlist: (watchlist.data ?? []).map((row) => row.symbol),
      // Settings stay on-device by design (theme, table density, chart range).
      settings: { livePrices: true, autoFillLimits: true, compactTables: false, defaultRange: "1M" },
    },
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function upsertInChunks(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<string | null> {
  for (const part of chunk(rows, UPSERT_CHUNK)) {
    const { error } = await client.from(table).upsert(part, { onConflict });
    if (error) return error.message;
  }
  return null;
}

export async function pushPortfolio(
  client: SupabaseClient,
  userId: string,
  state: PortfolioState,
): Promise<SyncResult> {
  try {
    // 1. Cash + realised P&L -------------------------------------------------
    const { error: portfolioError } = await client.from("portfolios").upsert(
      {
        user_id: userId,
        cash: state.cash,
        realized_pnl: state.realizedPnl,
        state_version: state.version,
        updated_at: toIso(Date.now()),
      },
      { onConflict: "user_id" },
    );
    if (portfolioError) return { ok: false, error: portfolioError.message };

    // 2. Profile (name / tier edited in Settings) ----------------------------
    const { error: profileError } = await client.from("profiles").upsert(
      {
        id: userId,
        display_name: state.account.name,
        tier: state.account.tier,
        account_number: state.account.accountNumber,
      },
      { onConflict: "id" },
    );
    if (profileError) return { ok: false, error: profileError.message };

    // 3. Positions — upsert current, drop the ones that were closed ----------
    const symbols = state.positions.map((position) => position.symbol);
    const deletePositions = client.from("positions").delete().eq("user_id", userId);
    const { error: positionDeleteError } = symbols.length
      ? await deletePositions.not("symbol", "in", inFilter(symbols))
      : await deletePositions;
    if (positionDeleteError) return { ok: false, error: positionDeleteError.message };

    const positionError = await upsertInChunks(
      client,
      "positions",
      state.positions.map((position) => ({
        user_id: userId,
        symbol: position.symbol,
        qty: position.qty,
        avg_cost: position.avgCost,
        opened_at: toIso(position.openedAt),
      })),
      "user_id,symbol",
    );
    if (positionError) return { ok: false, error: positionError };

    // 4. Watchlist -----------------------------------------------------------
    const { error: watchlistDeleteError } = state.watchlist.length
      ? await client.from("watchlist").delete().eq("user_id", userId).not("symbol", "in", inFilter(state.watchlist))
      : await client.from("watchlist").delete().eq("user_id", userId);
    if (watchlistDeleteError) return { ok: false, error: watchlistDeleteError.message };

    const watchlistError = await upsertInChunks(
      client,
      "watchlist",
      state.watchlist.map((symbol) => ({ user_id: userId, symbol })),
      "user_id,symbol",
    );
    if (watchlistError) return { ok: false, error: watchlistError };

    // 5. Orders --------------------------------------------------------------
    const orderError = await upsertInChunks(
      client,
      "orders",
      state.orders.slice(0, MAX_ORDERS).map((order) => ({
        id: order.id,
        user_id: userId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        qty: order.qty,
        limit_price: order.limitPrice,
        filled_price: order.filledPrice,
        notional: order.notional,
        status: order.status,
        created_at: toIso(order.createdAt),
        filled_at: order.filledAt === null ? null : toIso(order.filledAt),
      })),
      "id",
    );
    if (orderError) return { ok: false, error: orderError };

    // 6. Activity — append-only, so only new entries are sent. A reset makes
    //    the list shrink, which means the ledger was wiped: rewrite it. -------
    let known = syncedActivity.get(userId);
    if (!known) {
      known = new Set<string>();
      syncedActivity.set(userId, known);
    }
    const shrinking = state.activity.length < known.size;
    if (shrinking) {
      const { error } = await client.from("activity").delete().eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
      known.clear();
    }
    const pending = state.activity.filter((entry) => !known.has(entry.id)).slice(0, MAX_ACTIVITY);
    if (pending.length) {
      const activityError = await upsertInChunks(
        client,
        "activity",
        pending.map((entry) => ({
          id: entry.id,
          user_id: userId,
          type: entry.type,
          symbol: entry.symbol ?? null,
          qty: entry.qty ?? null,
          price: entry.price ?? null,
          amount: entry.amount,
          note: entry.note ?? null,
          order_id: entry.orderId ?? null,
          created_at: toIso(entry.createdAt),
        })),
        "id",
      );
      if (activityError) return { ok: false, error: activityError };
      for (const entry of pending) known.add(entry.id);
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach Supabase" };
  }
}

/** Wipes every row for a user and restores the starting cash. Used by "Reset". */
export async function clearPortfolio(
  client: SupabaseClient,
  userId: string,
  startingCash = STARTING_CASH,
): Promise<SyncResult> {
  try {
    const results = await Promise.all([
      client.from("positions").delete().eq("user_id", userId),
      client.from("orders").delete().eq("user_id", userId),
      client.from("activity").delete().eq("user_id", userId),
      client.from("watchlist").delete().eq("user_id", userId),
    ]);
    const error = firstError(...results);
    if (error) return { ok: false, error };

    const { error: portfolioError } = await client
      .from("portfolios")
      .upsert(
        { user_id: userId, cash: startingCash, realized_pnl: 0, state_version: STATE_VERSION },
        { onConflict: "user_id" },
      );
    if (portfolioError) return { ok: false, error: portfolioError.message };

    forgetSyncCache(userId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach Supabase" };
  }
}
