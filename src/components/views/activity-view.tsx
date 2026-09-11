"use client";

import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  FilterIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { StockAvatar } from "@/components/shared/stock-avatar";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatMoney, formatShares, relativeTime } from "@/lib/format";
import { usePortfolio } from "@/lib/store/provider";
import type { Activity, Order } from "@/lib/store/types";
import { cn } from "@/lib/utils";

type ActivityTab = "all" | "orders" | "cash";

const ACTIVITY_ICONS: Record<Activity["type"], typeof BanknoteIcon> = {
  buy: ArrowUpRightIcon,
  sell: ArrowDownRightIcon,
  deposit: LandmarkIcon,
  withdraw: BanknoteIcon,
  cancel: BanIcon,
  dividend: ReceiptTextIcon,
  fee: ReceiptTextIcon,
};

export function ActivityView() {
  const { state, hydrated, cancelOrder } = usePortfolio();
  const [tab, setTab] = React.useState<ActivityTab>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  const activity = state.activity;
  const orders = state.orders;

  const filteredActivity = React.useMemo(() => {
    if (typeFilter === "all") return activity;
    if (typeFilter === "trades") return activity.filter((entry) => entry.type === "buy" || entry.type === "sell");
    return activity.filter((entry) => entry.type === typeFilter);
  }, [activity, typeFilter]);

  const totals = React.useMemo(() => {
    const deposited = activity.filter((a) => a.type === "deposit").reduce((acc, a) => acc + a.amount, 0);
    const withdrawn = activity.filter((a) => a.type === "withdraw").reduce((acc, a) => acc + Math.abs(a.amount), 0);
    const bought = activity.filter((a) => a.type === "buy").reduce((acc, a) => acc + Math.abs(a.amount), 0);
    const sold = activity.filter((a) => a.type === "sell").reduce((acc, a) => acc + a.amount, 0);
    const trades = activity.filter((a) => a.type === "buy" || a.type === "sell").length;
    return { deposited, withdrawn, bought, sold, trades };
  }, [activity]);

  function exportJson() {
    const payload = { exportedAt: new Date().toISOString(), account: state.account, cash: state.cash, positions: state.positions, orders, activity };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `monievest-activity-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const pending = orders.filter((order) => order.status === "pending");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hydrated
              ? `${totals.trades} trades · ${orders.length} orders · ${pending.length} still open`
              : "Loading history…"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportJson} disabled={!hydrated}>
          <DownloadIcon />
          Export JSON
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={LandmarkIcon} label="Deposited" value={hydrated ? formatMoney(totals.deposited) : undefined} tone="gain" />
        <SummaryCard icon={BanknoteIcon} label="Withdrawn" value={hydrated ? formatMoney(totals.withdrawn) : undefined} />
        <SummaryCard icon={ArrowUpRightIcon} label="Bought" value={hydrated ? formatMoney(totals.bought) : undefined} />
        <SummaryCard icon={ArrowDownRightIcon} label="Sold" value={hydrated ? formatMoney(totals.sold) : undefined} />
        <SummaryCard
          icon={CheckCircle2Icon}
          label="Realised P&L"
          value={hydrated ? `${state.realizedPnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(state.realizedPnl))}` : undefined}
          tone={state.realizedPnl >= 0 ? "gain" : "loss"}
        />
      </div>

      {hydrated && pending.length > 0 && (
        <Card className="border-primary/35 bg-primary/5 p-0">
          <CardHeader className="flex-row items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" />
              <CardTitle className="text-[15px]">{pending.length} open order{pending.length === 1 ? "" : "s"}</CardTitle>
            </div>
            <span className="text-[11.5px] text-muted-foreground">
              {state.settings.autoFillLimits ? "Auto-fill is on — these execute when price is hit." : "Auto-fill is off in Settings."}
            </span>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 sm:grid-cols-2">
            {pending.map((order) => (
              <div key={order.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg border",
                    order.side === "buy" ? "border-gain/30 bg-gain-soft text-gain" : "border-loss/30 bg-loss-soft text-loss",
                  )}
                >
                  {order.side === "buy" ? <ArrowUpRightIcon className="size-4" /> : <ArrowDownRightIcon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <Link href={`/app/stock/${order.symbol}`} className="font-mono hover:underline">
                      {order.symbol}
                    </Link>
                    <Badge variant="muted" className="text-[9.5px] uppercase">
                      {order.type}
                    </Badge>
                  </p>
                  <p className="tnum text-[11.5px] text-muted-foreground">
                    {order.side === "buy" ? "Buy" : "Sell"} {formatShares(order.qty)} @ {formatMoney(order.limitPrice ?? 0)} ·{" "}
                    {relativeTime(order.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-[11.5px] text-muted-foreground hover:text-loss" onClick={() => cancelOrder(order.id)}>
                  <XIcon className="size-3.5" />
                  Cancel
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <Tabs value={tab} onValueChange={(value) => setTab(value as ActivityTab)} className="gap-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <TabsList>
              <TabsTrigger value="all">
                <ReceiptTextIcon />
                All
              </TabsTrigger>
              <TabsTrigger value="orders">
                <FilterIcon />
                Orders
              </TabsTrigger>
              <TabsTrigger value="cash">
                <BanknoteIcon />
                Cash
              </TabsTrigger>
            </TabsList>

            {tab === "all" && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Filter by activity type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="trades">Trades only</SelectItem>
                  <SelectItem value="buy">Buys</SelectItem>
                  <SelectItem value="sell">Sells</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdraw">Withdrawals</SelectItem>
                  <SelectItem value="dividend">Dividends</SelectItem>
                  <SelectItem value="cancel">Cancellations</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="all" className="mt-0">
            {!hydrated ? (
              <TableSkeleton rows={10} />
            ) : filteredActivity.length === 0 ? (
              <EmptyState
                icon={<ReceiptTextIcon className="size-5" />}
                title="No activity matches this filter"
                description="Try a different type, or place a trade to start building history."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="hidden md:table-cell">Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden pr-4 text-right lg:table-cell">Balance impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivity.map((entry) => {
                    const Icon = ACTIVITY_ICONS[entry.type];
                    const positive = entry.amount > 0;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="pl-4">
                          <p className="text-[12.5px] font-medium">{formatDateTime(entry.createdAt)}</p>
                          <p className="text-[11px] text-muted-foreground">{relativeTime(entry.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-lg border",
                                entry.type === "buy" && "border-gain/30 bg-gain-soft text-gain",
                                entry.type === "sell" && "border-loss/30 bg-loss-soft text-loss",
                                entry.type === "deposit" && "border-primary/30 bg-primary/10 text-primary",
                                entry.type === "dividend" && "border-gain/30 bg-gain-soft text-gain",
                                (entry.type === "withdraw" || entry.type === "fee") && "border-border bg-muted text-muted-foreground",
                                entry.type === "cancel" && "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold capitalize">{entry.type}</span>
                              {entry.symbol ? (
                                <Link href={`/app/stock/${entry.symbol}`} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:underline">
                                  <StockAvatar symbol={entry.symbol} size="xs" />
                                  <span className="font-mono">{entry.symbol}</span>
                                </Link>
                              ) : (
                                <span className="block text-[11.5px] text-muted-foreground">Cash account</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[22rem] md:table-cell">
                          <p className="tnum text-[12.5px]">
                            {entry.qty ? `${formatShares(entry.qty)} sh` : ""}
                            {entry.qty && entry.price ? " @ " : ""}
                            {entry.price ? formatMoney(entry.price) : ""}
                          </p>
                          {entry.note && <p className="truncate text-[11.5px] text-muted-foreground">{entry.note}</p>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "tnum text-[13px] font-semibold",
                              entry.amount === 0 ? "text-muted-foreground" : positive ? "text-gain" : "text-foreground",
                            )}
                          >
                            {entry.amount === 0 ? "—" : `${positive ? "+" : "−"}${formatMoney(Math.abs(entry.amount))}`}
                          </span>
                        </TableCell>
                        <TableCell className="hidden pr-4 text-right lg:table-cell">
                          <Badge
                            variant={entry.type === "cancel" ? "muted" : positive ? "success" : "secondary"}
                            className="capitalize"
                          >
                            {entry.type === "buy" || entry.type === "sell" ? "settled" : entry.type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            {!hydrated ? (
              <TableSkeleton rows={10} />
            ) : orders.length === 0 ? (
              <EmptyState icon={<FilterIcon className="size-5" />} title="No orders yet" description="Every order you place — market or limit — will be listed here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Placed</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Limit / fill</TableHead>
                    <TableHead className="text-right">Notional</TableHead>
                    <TableHead className="pr-4 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <OrderRow key={order.id} order={order} onCancel={() => cancelOrder(order.id)} />
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="cash" className="mt-0">
            {!hydrated ? (
              <TableSkeleton rows={6} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">When</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead className="hidden md:table-cell">Method</TableHead>
                    <TableHead className="pr-4 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity
                    .filter((entry) => ["deposit", "withdraw", "dividend", "fee"].includes(entry.type))
                    .map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="pl-4">
                          <p className="text-[12.5px] font-medium">{formatDateTime(entry.createdAt)}</p>
                          <p className="text-[11px] text-muted-foreground">{relativeTime(entry.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.type === "withdraw" ? "secondary" : entry.type === "dividend" ? "success" : "default"}
                            className="capitalize"
                          >
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-[24rem] truncate text-[12.5px] text-muted-foreground md:table-cell">
                          {entry.note ?? "—"}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <span className={cn("tnum text-[13px] font-semibold", entry.amount >= 0 ? "text-gain" : "text-foreground")}>
                            {entry.amount >= 0 ? "+" : "−"}
                            {formatMoney(Math.abs(entry.amount))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  {activity.filter((entry) => ["deposit", "withdraw", "dividend", "fee"].includes(entry.type)).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <EmptyState icon={<BanknoteIcon className="size-5" />} title="No cash movements yet" description="Fund your account from the Wallet page." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function OrderRow({ order, onCancel }: { order: Order; onCancel: () => void }) {
  return (
    <TableRow>
      <TableCell className="pl-4">
        <p className="text-[12.5px] font-medium">{formatDateTime(order.createdAt)}</p>
        <p className="text-[11px] text-muted-foreground">
          {order.filledAt ? `Filled ${relativeTime(order.filledAt)}` : relativeTime(order.createdAt)}
        </p>
      </TableCell>
      <TableCell>
        <Link href={`/app/stock/${order.symbol}`} className="flex items-center gap-2">
          <StockAvatar symbol={order.symbol} size="xs" />
          <span className="font-mono text-[12.5px] font-semibold hover:underline">{order.symbol}</span>
        </Link>
      </TableCell>
      <TableCell>
        <span className={cn("text-[12.5px] font-semibold capitalize", order.side === "buy" ? "text-gain" : "text-loss")}>
          {order.side}
        </span>
      </TableCell>
      <TableCell className="text-[12.5px] capitalize text-muted-foreground">{order.type}</TableCell>
      <TableCell className="tnum text-right text-[12.5px]">{formatShares(order.qty)}</TableCell>
      <TableCell className="tnum text-right text-[12.5px]">
        {formatMoney(order.filledPrice ?? order.limitPrice ?? 0)}
      </TableCell>
      <TableCell className="tnum text-right text-[12.5px] font-medium">{formatMoney(order.notional)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Badge
            variant={order.status === "filled" ? "success" : order.status === "pending" ? "default" : "muted"}
            className="capitalize"
          >
            {order.status}
          </Badge>
          {order.status === "pending" && (
            <Button size="icon-sm" variant="ghost" aria-label="Cancel order" className="text-muted-foreground hover:text-loss" onClick={onCancel}>
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BanknoteIcon;
  label: string;
  value?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {value ? (
        <p className={cn("tnum mt-2 text-lg font-semibold tracking-tight", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
          {value}
        </p>
      ) : (
        <Skeleton className="mt-2.5 h-5 w-24" />
      )}
    </Card>
  );
}
