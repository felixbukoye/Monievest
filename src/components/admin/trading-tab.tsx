"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SearchIcon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";

import { AdminCard, EmptyNote, ErrorNote, RefreshButton, TableSkeleton } from "./admin-shared";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchAdminUsers,
  fetchAllOrders,
  fetchAllPositions,
  type AdminOrder,
  type AdminProfile,
} from "@/lib/admin/data";
import { formatDateTime, formatMoney, formatShares } from "@/lib/format";
import { useMarket } from "@/components/market/market-provider";
import { cn } from "@/lib/utils";

type UserValue = {
  profile: AdminProfile;
  cash: number;
  holdingsValue: number;
  total: number;
  positionsCount: number;
  anomalies: string[];
};

const ORDER_LIMIT = 400;

export function TradingTab({ supabase }: { supabase: SupabaseClient }) {
  const { price } = useMarket();
  // `price` gets a new identity on every tick; keep the loader stable by
  // reading the latest version through a ref.
  const priceRef = React.useRef(price);
  React.useEffect(() => {
    priceRef.current = price;
  });

  const [orders, setOrders] = React.useState<AdminOrder[] | null>(null);
  const [userValues, setUserValues] = React.useState<UserValue[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [sideFilter, setSideFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [ordersResult, usersResult, positionsResult] = await Promise.all([
        fetchAllOrders(supabase, 6000),
        fetchAdminUsers(supabase),
        fetchAllPositions(supabase),
      ]);

      if (!ordersResult.ok) throw new Error(ordersResult.error);
      if (!usersResult.ok) throw new Error(usersResult.error);
      if (!positionsResult.ok) throw new Error(positionsResult.error);

      setOrders(ordersResult.orders);

      // Portfolio value per user: cash + positions priced at the current
      // board price (falls back to average cost for unquoted symbols).
      const cashByUser = new Map(usersResult.portfolios.map((row) => [row.user_id, row.cash]));
      const positionsByUser = new Map<string, { qty: number; avgCost: number; symbol: string }[]>();
      for (const position of positionsResult.positions) {
        const list = positionsByUser.get(position.user_id) ?? [];
        list.push({ qty: position.qty, avgCost: position.avg_cost, symbol: position.symbol });
        positionsByUser.set(position.user_id, list);
      }

      const values: UserValue[] = usersResult.profiles.map((profile) => {
        const cash = cashByUser.get(profile.id) ?? 0;
        const holdings = positionsByUser.get(profile.id) ?? [];
        let holdingsValue = 0;
        for (const position of holdings) {
          const marketPrice = priceRef.current(position.symbol);
          holdingsValue += position.qty * (marketPrice ?? position.avgCost);
        }
        const total = cash + holdingsValue;

        const anomalies: string[] = [];
        if (cash < 0) anomalies.push("Negative cash");
        if (holdingsValue < 0) anomalies.push("Negative holdings value");
        if (total < 0) anomalies.push("Negative portfolio value");
        if (cash > 1_000_000) anomalies.push("Cash over $1M — check for a deposit bug");
        if (holdings.some((position) => position.qty < 0)) anomalies.push("Negative position qty");

        return {
          profile,
          cash,
          holdingsValue,
          total,
          positionsCount: holdings.length,
          anomalies,
        };
      });

      setUserValues(values.sort((a, b) => b.total - a.total));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    // Deferred so the effect itself never calls setState synchronously.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    const needle = query.trim().toLowerCase();
    return orders
      .filter((order) => (sideFilter === "all" ? true : order.side === sideFilter))
      .filter((order) => (statusFilter === "all" ? true : order.status === statusFilter))
      .filter((order) => (needle ? order.symbol.toLowerCase().includes(needle) : true))
      .slice(0, ORDER_LIMIT);
  }, [orders, query, sideFilter, statusFilter]);

  const anomalyCount = userValues.filter((value) => value.anomalies.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton onClick={() => void load()} busy={busy} />
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <AdminCard
        title="Orders placed by users"
        description="Every market and limit order across all demo accounts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Symbol…"
                className="h-8 w-28 pl-8 text-[12px]"
              />
            </div>
            <Select value={sideFilter} onValueChange={setSideFilter}>
              <SelectTrigger className="h-8 w-24 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sides</SelectItem>
                <SelectItem value="buy">Buys</SelectItem>
                <SelectItem value="sell">Sells</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {!orders && !error ? <TableSkeleton /> : null}
        {orders && filteredOrders.length === 0 ? <EmptyNote>No orders match those filters yet.</EmptyNote> : null}
        {orders && filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Notional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const executedPrice = order.filled_price ?? order.limit_price;
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StockAvatar symbol={order.symbol} className="size-6" />
                          <span className="text-[12.5px] font-semibold">{order.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.side === "buy" ? "success" : "destructive"} className="uppercase">
                          {order.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="tnum text-right">{formatShares(order.qty)}</TableCell>
                      <TableCell className="tnum text-right">
                        {executedPrice ? formatMoney(executedPrice) : "—"}
                        {order.type === "limit" ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">limit</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tnum text-right">{formatMoney(Math.abs(order.notional))}</TableCell>
                      <TableCell>
                        <Badge
                          variant={order.status === "filled" ? "success" : order.status === "pending" ? "warning" : "muted"}
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] whitespace-nowrap text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {orders && orders.length > ORDER_LIMIT ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Showing the {ORDER_LIMIT} most recent of {orders.length} orders.
          </p>
        ) : null}
      </AdminCard>

      <AdminCard
        title="Portfolio value per user"
        description="Cash plus holdings priced at the current board value — a quick way to spot bugs and impossible data."
        actions={
          anomalyCount > 0 ? (
            <Badge variant="warning" className="gap-1">
              <TriangleAlertIcon />
              {anomalyCount} suspicious
            </Badge>
          ) : undefined
        }
      >
        {!orders && !error ? <TableSkeleton /> : null}
        {userValues.length === 0 && orders && !error ? <EmptyNote>No accounts yet.</EmptyNote> : null}
        {userValues.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Holdings</TableHead>
                  <TableHead className="text-right">Total value</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userValues.map((value) => (
                  <TableRow key={value.profile.id}>
                    <TableCell>
                      <p className="text-[13px] font-semibold">{value.profile.display_name}</p>
                      <p className="max-w-[220px] truncate text-[11px] text-muted-foreground">
                        {value.profile.email ?? "—"} · {value.positionsCount} position
                        {value.positionsCount === 1 ? "" : "s"}
                      </p>
                    </TableCell>
                    <TableCell className={cn("tnum text-right", value.cash < 0 && "font-semibold text-loss")}>
                      {formatMoney(value.cash)}
                    </TableCell>
                    <TableCell className="tnum text-right">{formatMoney(value.holdingsValue)}</TableCell>
                    <TableCell
                      className={cn(
                        "tnum text-right font-semibold",
                        value.total < 0 && "text-loss",
                      )}
                    >
                      {formatMoney(value.total)}
                    </TableCell>
                    <TableCell>
                      {value.anomalies.length === 0 ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <div className="flex max-w-[280px] flex-wrap gap-1">
                          {value.anomalies.map((anomaly) => (
                            <Badge key={anomaly} variant="warning" className="text-[10px]">
                              {anomaly}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
