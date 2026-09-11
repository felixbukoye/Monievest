"use client";

import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  ClockIcon,
  FlameIcon,
  PlusIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { useTrade } from "@/components/app/app-shell";
import { useMarket } from "@/components/market/market-provider";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { StockRail } from "@/components/dashboard/stock-rail";
import {
  PortfolioValuesCard,
  StatisticsCard,
  type StatPoint,
  type StatsScope,
} from "@/components/dashboard/summary-cards";
import { MyStockTable, buildMyStockRows } from "@/components/dashboard/my-stock-table";
import { PerformanceChart, RangeSelector } from "@/components/charts/price-chart";
import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { Sparkline } from "@/components/shared/sparkline";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactMoney, formatMoney, formatPercent, formatShares, relativeTime } from "@/lib/format";
import { getInstrument } from "@/lib/market/catalog";
import { getHistory } from "@/lib/market/engine";
import type { Range } from "@/lib/market/types";
import { usePortfolio } from "@/lib/store/provider";
import {
  allocationBy,
  buildHoldings,
  buildPerformance,
  summarise,
  topMovers,
} from "@/lib/store/selectors";
import { cn } from "@/lib/utils";

const DASHBOARD_RANGES: Range[] = ["1M", "3M", "6M", "1Y", "5Y"];

export function DashboardView() {
  const { state, hydrated, cancelOrder } = usePortfolio();
  const { quotes, ready, indices } = useMarket();
  const { openTrade } = useTrade();
  const [range, setRange] = React.useState<Range>("3M");
  const [moverTab, setMoverTab] = React.useState<"gainers" | "losers" | "active">("gainers");
  const [statsScope, setStatsScope] = React.useState<StatsScope>("portfolio");

  const summary = React.useMemo(() => summarise(state, quotes), [state, quotes]);
  const holdings = React.useMemo(() => buildHoldings(state, quotes), [state, quotes]);
  const slices = React.useMemo(() => allocationBy(holdings, "sector"), [holdings]);
  const performance = React.useMemo(() => buildPerformance(state, range), [state, range]);
  const movers = React.useMemo(() => topMovers(quotes), [quotes]);
  const myStock = React.useMemo(() => buildMyStockRows(holdings, state.activity), [holdings, state.activity]);

  // Best / worst position by unrealised return — drives the reference design's
  // "Top / Worst Performance" pills and what the Statistics chart plots.
  const ranked = React.useMemo(
    () => [...holdings].sort((a, b) => b.unrealizedPnlPct - a.unrealizedPnlPct),
    [holdings],
  );
  const topHolding = ranked[0] ?? null;
  const worstHolding = ranked.length > 1 ? ranked[ranked.length - 1]! : null;
  const focusHolding = statsScope === "worst" ? worstHolding : statsScope === "top" ? topHolding : null;

  const monthSeries = React.useMemo(() => buildPerformance(state, "1M", false), [state]);
  const statData = React.useMemo<StatPoint[]>(() => {
    if (!hydrated) return [];
    if (focusHolding) {
      return getHistory(focusHolding.instrument, "1M").map((candle) => ({ t: candle.t, value: candle.c }));
    }
    return monthSeries.map((point) => ({ t: point.t, value: point.value }));
  }, [hydrated, focusHolding, monthSeries]);
  const statSubject = focusHolding
    ? `${focusHolding.instrument.symbol} · ${statsScope === "worst" ? "weakest" : "strongest"} holding`
    : "Whole portfolio";

  const pending = state.orders.filter((order) => order.status === "pending");
  const watched = state.watchlist
    .map((symbol) => ({ instrument: getInstrument(symbol)!, quote: quotes[symbol] }))
    .filter((row) => row.instrument && row.quote)
    .slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const performanceStart = performance[0]?.value ?? 0;
  const performanceLast = performance[performance.length - 1]?.value ?? 0;
  const performanceChangePct = performanceStart > 0 ? ((performanceLast - performanceStart) / performanceStart) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {greeting}, {state.account.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hydrated ? (
              <>
                {summary.positionCount} position{summary.positionCount === 1 ? "" : "s"} ·{" "}
                {formatMoney(summary.marketValue)} invested · {formatCompactMoney(summary.cash)} cash
              </>
            ) : (
              "Loading your portfolio…"
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-10 rounded-full border-border/70 bg-card px-4">
            <Link href="/app/wallet">
              <BanknoteIcon />
              Add funds
            </Link>
          </Button>
          <Button size="sm" onClick={() => openTrade()} className="h-10 gap-1.5 rounded-full px-5">
            <PlusIcon />
            New trade
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- stock card rail */}
      <StockRail />

      {/* ------------------------------------------- values + statistics */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <PortfolioValuesCard
          ready={hydrated && ready}
          totalValue={summary.totalValue}
          changeAmount={summary.totalReturn}
          changePct={summary.totalReturnPct}
          profitAmount={summary.unrealizedPnl}
          positionCount={summary.positionCount}
          top={topHolding}
          worst={worstHolding}
          scope={statsScope}
          onScope={setStatsScope}
          stats={[
            {
              label: "Today",
              value: `${summary.dayChange >= 0 ? "+" : "\u2212"}${formatMoney(Math.abs(summary.dayChange))}`,
              sub: formatPercent(summary.dayChangePct),
              tone: summary.dayChange >= 0 ? "gain" : "loss",
            },
            { label: "Invested", value: formatCompactMoney(summary.invested) },
            { label: "Cash", value: formatCompactMoney(summary.cash) },
          ]}
        />

        <StatisticsCard
          ready={hydrated && ready}
          subject={statSubject}
          caption="last month"
          data={statData}
        />
      </div>

      {/* ----------------------------------------------- performance + split */}
      <div className="grid gap-4 xl:grid-cols-[1.62fr_1fr]">
        <Card className="p-0">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
            <div className="space-y-1">
              <CardTitle>Portfolio performance</CardTitle>
              <CardDescription className="flex items-center gap-3">
                <span>
                  {ready && hydrated ? (
                    <>
                      <span className={cn("tnum font-semibold", performanceChangePct >= 0 ? "text-gain" : "text-loss")}>
                        {formatPercent(performanceChangePct)}
                      </span>{" "}
                      over the selected period
                    </>
                  ) : (
                    "Calculating…"
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-0.5 w-4 rounded-full bg-primary" /> Portfolio
                  <span className="ml-2 h-0.5 w-4 rounded-full border-t border-dashed border-muted-foreground" /> S&amp;P 500
                </span>
              </CardDescription>
            </div>
            <RangeSelector range={range} onChange={setRange} ranges={DASHBOARD_RANGES} size="sm" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            {hydrated ? (
              <PerformanceChart data={performance} height={292} />
            ) : (
              <Skeleton className="h-[292px] w-full rounded-lg" />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Allocation by sector</CardTitle>
              <CardDescription>Share of invested capital</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <AllocationChart
                slices={slices}
                size={168}
                centerLabel="Invested"
                centerValue={hydrated ? formatCompactMoney(summary.marketValue) : "—"}
              />
              <ul className="w-full flex-1 space-y-1.5">
                {slices.slice(0, 6).map((slice) => (
                  <li key={slice.key} className="flex items-center gap-2 text-[12.5px]">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.label}</span>
                    <span className="tnum font-semibold">{slice.weight.toFixed(1)}%</span>
                  </li>
                ))}
                {slices.length === 0 && (
                  <li className="text-[12.5px] text-muted-foreground">Nothing held yet.</li>
                )}
                {slices.length > 6 && (
                  <li className="pt-1 text-[11.5px] text-muted-foreground">
                    + {slices.length - 6} more sector{slices.length - 6 === 1 ? "" : "s"}
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex-row items-center justify-between gap-2 border-b p-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FlameIcon className="size-4 text-warning" />
                  Market movers
                </CardTitle>
                <CardDescription className="text-xs">Live from the simulator</CardDescription>
              </div>
            </CardHeader>
            <Tabs value={moverTab} onValueChange={(value) => setMoverTab(value as typeof moverTab)} className="p-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="gainers">Gainers</TabsTrigger>
                <TabsTrigger value="losers">Losers</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
              </TabsList>

              <div className="mt-2 space-y-0.5">
                {!ready
                  ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-11 w-full rounded-lg" />)
                  : movers[moverTab].slice(0, 5).map((row) => (
                      <Link
                        key={row.instrument.symbol}
                        href={`/app/stock/${row.instrument.symbol}`}
                        className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-accent/60"
                      >
                        <StockAvatar symbol={row.instrument.symbol} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[12.5px] font-semibold">{row.instrument.symbol}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{row.instrument.industry}</p>
                        </div>
                        <Sparkline data={row.quote.intraday.slice(-40).map((p) => p.p)} width={54} height={22} fill={false} />
                        <div className="w-[4.6rem] text-right">
                          <LivePrice symbol={row.instrument.symbol} size="sm" className="block" showFlash={false} />
                          <span
                            className={cn(
                              "tnum text-[11px] font-semibold",
                              row.quote.changePct >= 0 ? "text-gain" : "text-loss",
                            )}
                          >
                            {formatPercent(row.quote.changePct)}
                          </span>
                        </div>
                      </Link>
                    ))}
              </div>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------- my stock + side */}
      <div className="grid gap-5 xl:grid-cols-[1.62fr_1fr]">
        <Card className="overflow-hidden p-0">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-[17px] font-semibold tracking-tight">My Stock</CardTitle>
              <span className="tnum rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {hydrated ? myStock.length : "—"}
              </span>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-full text-primary">
              <Link href="/app/portfolio">
                View portfolio
                <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>

          {!hydrated ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : myStock.length === 0 ? (
            <EmptyState
              icon={<ArrowUpRightIcon className="size-5" />}
              title="No stock yet"
              description="Buy your first position and it will show up here with its invest date, volume and change."
              className="py-12"
              action={
                <Button size="sm" className="rounded-full" onClick={() => openTrade()}>
                  <PlusIcon />
                  New trade
                </Button>
              }
            />
          ) : (
            <MyStockTable rows={myStock} onTrade={openTrade} />
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader className="flex-row items-center justify-between gap-2 border-b p-4">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <ClockIcon className="size-4 text-primary" />
                Open orders
                {pending.length > 0 && <Badge variant="default">{pending.length}</Badge>}
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/app/activity">History</Link>
              </Button>
            </CardHeader>

            {pending.length === 0 ? (
              <EmptyState
                icon={<ClockIcon className="size-5" />}
                title="No resting orders"
                description="Limit orders you place will sit here until the price is hit."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {pending.slice(0, 4).map((order) => {
                  const quote = quotes[order.symbol];
                  const distance =
                    quote && order.limitPrice
                      ? ((order.limitPrice - quote.price) / quote.price) * 100
                      : null;
                  return (
                    <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg border",
                          order.side === "buy"
                            ? "border-gain/30 bg-gain-soft text-gain"
                            : "border-loss/30 bg-loss-soft text-loss",
                        )}
                      >
                        {order.side === "buy" ? (
                          <ArrowUpRightIcon className="size-4" />
                        ) : (
                          <ArrowDownRightIcon className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                          <span className="font-mono">{order.symbol}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="capitalize">{order.side}</span>
                          <Badge variant="muted" className="text-[9.5px] uppercase">
                            {order.type}
                          </Badge>
                        </p>
                        <p className="tnum text-[11.5px] text-muted-foreground">
                          {formatShares(order.qty)} sh @ {formatMoney(order.limitPrice ?? 0)}
                          {distance != null && (
                            <>
                              {" "}
                              · <span className={cn(Math.abs(distance) < 1.5 ? "text-warning" : "")}>{formatPercent(distance, { decimals: 1 })} away</span>
                            </>
                          )}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-loss"
                            aria-label="Cancel order"
                            onClick={() => cancelOrder(order.id)}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel order</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-0">
            <CardHeader className="flex-row items-center justify-between gap-2 border-b p-4">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <StarIcon className="size-4 text-warning" />
                Watchlist
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/app/watchlist">All</Link>
              </Button>
            </CardHeader>

            {watched.length === 0 ? (
              <EmptyState
                icon={<StarIcon className="size-5" />}
                title="Your watchlist is empty"
                description="Star an instrument anywhere in the app to track it here."
                className="py-10"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/app/markets">Browse markets</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {watched.map(({ instrument, quote }) => (
                  <li key={instrument.symbol}>
                    <Link
                      href={`/app/stock/${instrument.symbol}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
                    >
                      <StockAvatar symbol={instrument.symbol} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[12.5px] font-semibold">{instrument.symbol}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{instrument.name}</p>
                      </div>
                      <div className="text-right">
                        <LivePrice symbol={instrument.symbol} size="sm" className="block" showFlash={false} />
                        <span
                          className={cn(
                            "tnum text-[11px] font-semibold",
                            quote.changePct >= 0 ? "text-gain" : "text-loss",
                          )}
                        >
                          {formatPercent(quote.changePct)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px]">Index snapshot</CardTitle>
              <CardDescription>Simulated broad-market benchmarks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ready ? (
                indices.map((index) => (
                  <div key={index.symbol} className="flex items-center gap-3">
                    <Sparkline data={index.spark} width={62} height={22} fill={false} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold">{index.name}</p>
                      <p className="tnum text-[11px] text-muted-foreground">
                        {index.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <ChangeChip pct={index.changePct} size="sm" />
                  </div>
                ))
              ) : (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-8 w-full rounded-lg" />)
              )}
            </CardContent>
          </Card>

          {state.activity.length > 0 && (
            <Card className="p-0">
              <CardHeader className="border-b p-4">
                <CardTitle className="text-[15px]">Recent activity</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-border/60">
                {state.activity.slice(0, 4).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg border",
                        entry.type === "buy" && "border-gain/30 bg-gain-soft text-gain",
                        entry.type === "sell" && "border-loss/30 bg-loss-soft text-loss",
                        (entry.type === "deposit" || entry.type === "dividend") && "border-primary/30 bg-primary/10 text-primary",
                        (entry.type === "withdraw" || entry.type === "cancel" || entry.type === "fee") &&
                          "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {entry.type === "buy" ? (
                        <ArrowUpRightIcon className="size-3.5" />
                      ) : entry.type === "sell" ? (
                        <ArrowDownRightIcon className="size-3.5" />
                      ) : (
                        <BanknoteIcon className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize">
                        {entry.type} {entry.symbol ? <span className="font-mono">{entry.symbol}</span> : null}
                        {entry.qty ? ` · ${formatShares(entry.qty)} sh` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{relativeTime(entry.createdAt)}</p>
                    </div>
                    <span
                      className={cn(
                        "tnum font-semibold",
                        entry.amount > 0 ? "text-gain" : entry.amount < 0 ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {entry.amount > 0 ? "+" : entry.amount < 0 ? "−" : ""}
                      {entry.amount !== 0 ? formatMoney(Math.abs(entry.amount)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

