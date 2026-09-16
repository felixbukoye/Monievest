"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";

import { AdminCard, EmptyNote, ErrorNote, RefreshButton, StatCard, TableSkeleton } from "./admin-shared";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllOrders, readCount, type AdminOrder } from "@/lib/admin/data";
import { formatCompactMoney, formatNumber } from "@/lib/format";
import { getInstrument } from "@/lib/market/catalog";

type OverviewStats = {
  totalSignups: number;
  signupsLast7Days: number;
  totalOrders: number;
  filledOrders: number;
  openFeedback: number;
  disabledAccounts: number;
  signupsByDay: { key: string; label: string; count: number }[];
  orders: AdminOrder[];
};

const DAY_MS = 86_400_000;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function OverviewTab({ supabase }: { supabase: SupabaseClient }) {
  const [stats, setStats] = React.useState<OverviewStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const now = Date.now();
      const weekAgo = new Date(now - 7 * DAY_MS).toISOString();

      const [signups, signupsRecent, ordersResult, filled, openFeedback, disabled, profiles] = await Promise.all([
        readCount(await supabase.from("profiles").select("*", { count: "exact", head: true })),
        readCount(
          await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
        ),
        fetchAllOrders(supabase, 8000),
        readCount(
          await supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "filled"),
        ),
        readCount(
          await supabase.from("feedback").select("*", { count: "exact", head: true }).eq("status", "open"),
        ),
        readCount(
          await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "disabled"),
        ),
        supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(2000),
      ]);

      if ("ok" in ordersResult && !ordersResult.ok) throw new Error(ordersResult.error);
      if (profiles.error) throw new Error(profiles.error.message);

      // Sign-ups over the last 14 days for the mini bar chart.
      const buckets = new Map<string, number>();
      for (let i = 13; i >= 0; i--) buckets.set(dayKey(now - i * DAY_MS), 0);
      for (const row of profiles.data ?? []) {
        const key = dayKey(Date.parse(String(row.created_at)));
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      setStats({
        totalSignups: signups.count,
        signupsLast7Days: signupsRecent.count,
        totalOrders: ordersResult.ok ? ordersResult.orders.length : 0,
        filledOrders: filled.count,
        openFeedback: openFeedback.count,
        disabledAccounts: disabled.count,
        signupsByDay: Array.from(buckets, ([key, count]) => ({
          key,
          label: new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
          count,
        })),
        orders: ordersResult.ok ? ordersResult.orders : [],
      });
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

  const mostTraded = React.useMemo(() => {
    if (!stats) return [];
    const bySymbol = new Map<string, { orders: number; filled: number; buys: number; notional: number }>();
    for (const order of stats.orders) {
      if (order.status === "cancelled") continue;
      const entry = bySymbol.get(order.symbol) ?? { orders: 0, filled: 0, buys: 0, notional: 0 };
      entry.orders += 1;
      if (order.status === "filled") entry.filled += 1;
      if (order.side === "buy") entry.buys += 1;
      entry.notional += Math.abs(order.notional);
      bySymbol.set(order.symbol, entry);
    }
    return Array.from(bySymbol, ([symbol, entry]) => ({ symbol, ...entry }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);
  }, [stats]);

  const maxDayCount = React.useMemo(
    () => Math.max(1, ...(stats?.signupsByDay.map((day) => day.count) ?? [1])),
    [stats],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton onClick={() => void load()} busy={busy} />
      </div>

      {error ? <ErrorNote message={error} /> : null}

      {!stats && !error ? <TableSkeleton rows={4} /> : null}

      {stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total sign-ups"
              value={formatNumber(stats.totalSignups)}
              hint={`${formatNumber(stats.signupsLast7Days)} in the last 7 days`}
            />
            <StatCard
              label="Demo trades placed"
              value={formatNumber(stats.totalOrders)}
              hint={`${formatNumber(stats.filledOrders)} filled orders`}
            />
            <StatCard
              label="Open feedback"
              value={formatNumber(stats.openFeedback)}
              hint="Replies live in the Support tab"
              tone={stats.openFeedback > 0 ? "loss" : "default"}
            />
            <StatCard
              label="Disabled accounts"
              value={formatNumber(stats.disabledAccounts)}
              hint="Blocked from signing in"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <AdminCard
              title="Most traded stocks"
              description="What people are actually interested in — orders per symbol, excluding cancellations."
              className="lg:col-span-3"
            >
              {mostTraded.length === 0 ? (
                <EmptyNote>No trades yet. Once users start trading, the most active symbols land here.</EmptyNote>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Filled</TableHead>
                      <TableHead className="text-right">Buy share</TableHead>
                      <TableHead className="text-right">Notional</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mostTraded.map((row) => {
                      const instrument = getInstrument(row.symbol);
                      const buyShare = row.orders > 0 ? Math.round((row.buys / row.orders) * 100) : 0;
                      return (
                        <TableRow key={row.symbol}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <StockAvatar symbol={row.symbol} className="size-7" />
                              <div>
                                <p className="text-[13px] font-semibold">{row.symbol}</p>
                                <p className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                                  {instrument?.name ?? "Custom / external symbol"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tnum text-right font-medium">{formatNumber(row.orders)}</TableCell>
                          <TableCell className="tnum text-right">{formatNumber(row.filled)}</TableCell>
                          <TableCell className="tnum text-right">{buyShare}% buys</TableCell>
                          <TableCell className="tnum text-right">{formatCompactMoney(row.notional)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </AdminCard>

            <AdminCard
              title="Sign-ups — last 14 days"
              description="New accounts per day."
              className="lg:col-span-2"
            >
              <div className="flex h-[180px] items-end gap-1.5 px-1 pt-2">
                {stats.signupsByDay.map((day) => (
                  <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="tnum text-[10px] text-muted-foreground">{day.count > 0 ? day.count : ""}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/70 transition-all"
                      style={{ height: `${Math.max(4, (day.count / maxDayCount) * 100)}%`, opacity: day.count === 0 ? 0.25 : 1 }}
                      title={`${day.key}: ${day.count} sign-up${day.count === 1 ? "" : "s"}`}
                    />
                    <span className="text-[9px] text-muted-foreground">{day.label.slice(0, 2)}</span>
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
