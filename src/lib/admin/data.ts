import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Data access for the admin dashboard.
 *
 * Everything runs through the regular browser client — the "admin" superpower
 * comes entirely from Row Level Security (migration 0002): the admin policies
 * answer `public.is_admin()`, and ordinary users get zero rows from these
 * queries. Nothing here trusts the UI; the database is the gatekeeper.
 */

export type AdminRole = "user" | "admin";
export type AccountStatus = "active" | "disabled";

export type AdminProfile = {
  id: string;
  display_name: string;
  email: string | null;
  role: AdminRole;
  status: AccountStatus;
  account_number: string;
  created_at: string;
};

export type AdminPortfolio = {
  user_id: string;
  cash: number;
  realized_pnl: number;
  updated_at: string | null;
};

export type AdminPosition = {
  user_id: string;
  symbol: string;
  qty: number;
  avg_cost: number;
};

export type AdminOrder = {
  id: string;
  user_id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  limit_price: number | null;
  filled_price: number | null;
  notional: number;
  status: "filled" | "pending" | "cancelled";
  created_at: string;
  filled_at: string | null;
};

export type FeedbackRow = {
  id: string;
  user_id: string;
  email: string | null;
  category: "feedback" | "bug" | "feature";
  message: string;
  status: "open" | "replied" | "closed";
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export type DemoStockRow = {
  symbol: string;
  name: string;
  kind: "stock" | "etf";
  sector: string;
  reference_price: number;
  source: "custom" | "catalog";
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminDataError = { ok: false; error: string };

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseProfile(row: Record<string, unknown>): AdminProfile {
  return {
    id: String(row.id ?? ""),
    display_name: String(row.display_name ?? "Investor"),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    role: row.role === "admin" ? "admin" : "user",
    status: row.status === "disabled" ? "disabled" : "active",
    account_number: String(row.account_number ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function normalisePortfolio(row: Record<string, unknown>): AdminPortfolio {
  return {
    user_id: String(row.user_id ?? ""),
    cash: toNumber(row.cash),
    realized_pnl: toNumber(row.realized_pnl),
    updated_at: row.updated_at === null ? null : String(row.updated_at),
  };
}

function normalisePosition(row: Record<string, unknown>): AdminPosition {
  return {
    user_id: String(row.user_id ?? ""),
    symbol: String(row.symbol ?? ""),
    qty: toNumber(row.qty),
    avg_cost: toNumber(row.avg_cost),
  };
}

function normaliseOrder(row: Record<string, unknown>): AdminOrder {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    symbol: String(row.symbol ?? ""),
    side: row.side === "sell" ? "sell" : "buy",
    type: row.type === "limit" ? "limit" : "market",
    qty: toNumber(row.qty),
    limit_price: row.limit_price === null ? null : toNumber(row.limit_price),
    filled_price: row.filled_price === null ? null : toNumber(row.filled_price),
    notional: toNumber(row.notional),
    status: row.status === "pending" || row.status === "cancelled" ? row.status : "filled",
    created_at: String(row.created_at ?? new Date().toISOString()),
    filled_at: row.filled_at === null ? null : String(row.filled_at),
  };
}

function normaliseFeedback(row: Record<string, unknown>): FeedbackRow {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    category: row.category === "bug" || row.category === "feature" ? row.category : "feedback",
    message: String(row.message ?? ""),
    status: row.status === "replied" || row.status === "closed" ? row.status : "open",
    admin_reply: row.admin_reply === null || row.admin_reply === undefined ? null : String(row.admin_reply),
    replied_at: row.replied_at === null ? null : String(row.replied_at),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function normaliseDemoStock(row: Record<string, unknown>): DemoStockRow {
  return {
    symbol: String(row.symbol ?? "").toUpperCase(),
    name: String(row.name ?? ""),
    kind: row.kind === "etf" ? "etf" : "stock",
    sector: String(row.sector ?? "Technology"),
    reference_price: toNumber(row.reference_price),
    source: row.source === "catalog" ? "catalog" : "custom",
    enabled: row.enabled !== false,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

type PageResult = { data: Record<string, unknown>[] | null; error: { message: string } | null };

/** PostgREST caps one response at 1,000 rows by default — walk the ranges. */
async function fetchPaged<T>(
  run: (from: number, to: number) => PromiseLike<PageResult>,
  maxRows: number,
): Promise<{ rows: T[]; error: string | null }> {
  const PAGE = 1000;
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  return { rows, error: null };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchAdminUsers(client: SupabaseClient): Promise<
  { ok: true; profiles: AdminProfile[]; portfolios: AdminPortfolio[] } | AdminDataError
> {
  const [profiles, portfolios] = await Promise.all([
    client
      .from("profiles")
      .select("id,display_name,email,role,status,account_number,created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    client.from("portfolios").select("user_id,cash,realized_pnl,updated_at"),
  ]);

  if (profiles.error) return { ok: false, error: profiles.error.message };
  if (portfolios.error) return { ok: false, error: portfolios.error.message };

  return {
    ok: true,
    profiles: ((profiles.data ?? []) as Record<string, unknown>[]).map(normaliseProfile),
    portfolios: ((portfolios.data ?? []) as Record<string, unknown>[]).map(normalisePortfolio),
  };
}

export async function fetchAllPositions(
  client: SupabaseClient,
  maxRows = 8000,
): Promise<{ ok: true; positions: AdminPosition[] } | AdminDataError> {
  const { rows, error } = await fetchPaged<AdminPosition>(
    (from, to) => client.from("positions").select("user_id,symbol,qty,avg_cost").order("user_id").range(from, to),
    maxRows,
  );
  if (error) return { ok: false, error };
  return { ok: true, positions: (rows as unknown as Record<string, unknown>[]).map(normalisePosition) };
}

export async function fetchAllOrders(
  client: SupabaseClient,
  maxRows = 8000,
): Promise<{ ok: true; orders: AdminOrder[] } | AdminDataError> {
  const { rows, error } = await fetchPaged<{ raw: Record<string, unknown> }>(
    async (from, to) => {
      const result = await client
        .from("orders")
        .select("id,user_id,symbol,side,type,qty,limit_price,filled_price,notional,status,created_at,filled_at")
        .order("created_at", { ascending: false })
        .range(from, to);
      return result as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    },
    maxRows,
  );
  if (error) return { ok: false, error };
  return { ok: true, orders: (rows as unknown as Record<string, unknown>[]).map(normaliseOrder) };
}

export async function fetchFeedback(client: SupabaseClient): Promise<{ ok: true; feedback: FeedbackRow[] } | AdminDataError> {
  const { data, error } = await client
    .from("feedback")
    .select("id,user_id,email,category,message,status,admin_reply,replied_at,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return { ok: false, error: error.message };
  return { ok: true, feedback: ((data ?? []) as Record<string, unknown>[]).map(normaliseFeedback) };
}

export async function fetchDemoStocks(client: SupabaseClient): Promise<{ ok: true; stocks: DemoStockRow[] } | AdminDataError> {
  const { data, error } = await client
    .from("demo_stocks")
    .select("symbol,name,kind,sector,reference_price,source,enabled,created_at,updated_at")
    .order("symbol", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, stocks: ((data ?? []) as Record<string, unknown>[]).map(normaliseDemoStock) };
}

/** Extracts `{ count }` from a `select(..., { count: "exact", head: true })` call. */
export function readCount(result: {
  count: number | null;
  error: { message: string } | null;
}): { count: number; error: string | null } {
  if (result.error) return { count: 0, error: result.error.message };
  return { count: result.count ?? 0, error: null };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function setUserStatus(
  client: SupabaseClient,
  userId: string,
  status: AccountStatus,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("profiles").update({ status }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function replyToFeedback(
  client: SupabaseClient,
  feedbackId: string,
  reply: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client
    .from("feedback")
    .update({ admin_reply: reply, status: "replied", replied_at: new Date().toISOString() })
    .eq("id", feedbackId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setFeedbackStatus(
  client: SupabaseClient,
  feedbackId: string,
  status: FeedbackRow["status"],
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("feedback").update({ status }).eq("id", feedbackId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertDemoStock(
  client: SupabaseClient,
  row: {
    symbol: string;
    name: string;
    kind: "stock" | "etf";
    sector: string;
    reference_price: number;
    source: "custom" | "catalog";
    enabled: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("demo_stocks").upsert(row, { onConflict: "symbol" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteDemoStock(
  client: SupabaseClient,
  symbol: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("demo_stocks").delete().eq("symbol", symbol);
  return error ? { ok: false, error: error.message } : { ok: true };
}
