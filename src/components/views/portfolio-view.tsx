"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  DownloadIcon,
  GaugeIcon,
  LayersIcon,
  PieChartIcon,
  PiggyBankIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import * as React from "react";

import { useTrade } from "@/components/app/app-shell";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { PerformanceChart, RangeSelector } from "@/components/charts/price-chart";
import { useMarket } from "@/components/market/market-provider";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { ChangeChip } from "@/components/shared/prices";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompactMoney, formatMoney, formatPercent, formatShares } from "@/lib/format";
import type { Range } from "@/lib/market/types";
import { usePortfolio } from "@/lib/store/provider";
import { allocationBy, buildHoldings, buildPerformance, summarise } from "@/lib/store/selectors";
import { cn } from "@/lib/utils";

const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "5Y"];

export function PortfolioView() {
  const { state, hydrated } = usePortfolio();
  const { quotes } = useMarket();
  const { openTrade } = useTrade();

  const [range, setRange] = React.useState<Range>("1Y");
  const [allocationKey, setAllocationKey] = React.useState<"sector" | "symbol">("sector");

  const summary = React.useMemo(() => summarise(state, quotes), [state, quotes]);
  const holdings = React.useMemo(() => buildHoldings(state, quotes), [state, quotes]);
  const performance = React.useMemo(() => buildPerformance(state, range), [state, range]);
  const slices = React.useMemo(() => allocationBy(holdings, allocationKey), [holdings, allocationKey]);

  const topHolding = holdings[0];
  const concentration = topHolding?.weight ?? 0;
  const bestHolding = [...holdings].sort((a, b) => b.unrealizedPnlPct - a.unrealizedPnlPct)[0];
  const worstHolding = [...holdings].sort((a, b) => a.unrealizedPnlPct - b.unrealizedPnlPct)[0];
  const investedRatio = summary.totalValue > 0 ? (summary.marketValue / summary.totalValue) * 100 : 0;

  function exportCsv() {
    const header = [
      "symbol",
      "name",
      "sector",
      "quantity",
      "average_cost",
      "last_price",
      "market_value",
      "cost_basis",
      "unrealised_pnl",
      "unrealised_pnl_pct",
      "weight_pct",
    ];
    const rows = holdings.map((holding) => [
      holding.instrument.symbol,
      `"${holding.instrument.name.replace(/"/g, '""')}"`,
      `"${holding.instrument.sector}"`,
      holding.qty,
      holding.avgCost.toFixed(4),
      holding.price.toFixed(4),
      holding.marketValue.toFixed(2),
      holding.costBasis.toFixed(2),
      holding.unrealizedPnl.toFixed(2),
      holding.unrealizedPnlPct.toFixed(2),
      holding.weight.toFixed(2),
    ]);
    const summaryRows = [
      [],
      ["cash", summary.cash.toFixed(2)],
      ["invested_cost_basis", summary.invested.toFixed(2)],
      ["market_value", summary.marketValue.toFixed(2)],
      ["total_value", summary.totalValue.toFixed(2)],
      ["unrealised_pnl", summary.unrealizedPnl.toFixed(2)],
      ["realised_pnl", summary.realizedPnl.toFixed(2)],
      ["net_contributions", summary.netContributions.toFixed(2)],
      ["total_return", summary.totalReturn.toFixed(2)],
    ];
    const csv = [...[header], ...rows, ...summaryRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `monievest-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hydrated
              ? `${summary.positionCount} holdings across ${new Set(holdings.map((h) => h.instrument.sector)).size} sectors`
              : "Loading holdings…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={holdings.length === 0}>
            <DownloadIcon />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => openTrade()}>
            <ArrowUpRightIcon />
            New trade
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------------- summary */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-primary/12 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Total portfolio value
              </p>
              {hydrated ? (
                <p className="tnum mt-1 text-4xl font-semibold tracking-tight">{formatMoney(summary.totalValue)}</p>
              ) : (
                <Skeleton className="mt-2 h-10 w-48" />
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                {hydrated && <ChangeChip value={summary.dayChange} pct={summary.dayChangePct} />}
                <span className="text-[12.5px] text-muted-foreground">today</span>
                <Separator orientation="vertical" className="h-4" />
                <span
                  className={cn(
                    "tnum text-[12.5px] font-semibold",
                    summary.totalReturn >= 0 ? "text-gain" : "text-loss",
                  )}
                >
                  {summary.totalReturn >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(summary.totalReturn))} ({formatPercent(summary.totalReturnPct)}) all time
                </span>
              </div>
            </div>

            <RangeSelector range={range} onChange={setRange} ranges={RANGES} size="sm" />
          </div>

          <div className="relative mt-5">
            {hydrated ? (
              <PerformanceChart data={performance} height={248} />
            ) : (
              <Skeleton className="h-[248px] w-full rounded-lg" />
            )}
            <p className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-primary" /> Portfolio
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full border-t border-dashed border-muted-foreground" /> S&amp;P 500
              </span>
            </p>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
              <div>
                <CardTitle className="text-[15px]">Allocation</CardTitle>
                <CardDescription>Where your invested capital sits</CardDescription>
              </div>
              <Tabs
                value={allocationKey}
                onValueChange={(value) => setAllocationKey(value as "sector" | "symbol")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="sector" className="px-2 text-[11.5px]">
                    Sector
                  </TabsTrigger>
                  <TabsTrigger value="symbol" className="px-2 text-[11.5px]">
                    Holding
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 sm:flex-row">
              <AllocationChart
                slices={slices}
                size={158}
                centerLabel={allocationKey === "sector" ? "Invested" : "Holdings"}
                centerValue={hydrated ? formatCompactMoney(summary.marketValue) : "—"}
              />
              <ul className="max-h-[190px] w-full flex-1 space-y-1.5 overflow-y-auto pr-1">
                {slices.map((slice) => (
                  <li key={slice.key} className="flex items-center gap-2 text-[12.5px]">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.label}</span>
                    <span className="tnum shrink-0 text-muted-foreground">{formatCompactMoney(slice.value)}</span>
                    <span className="tnum w-11 shrink-0 text-right font-semibold">{slice.weight.toFixed(1)}%</span>
                  </li>
                ))}
                {slices.length === 0 && <li className="text-[12.5px] text-muted-foreground">Nothing held yet.</li>}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <GaugeIcon className="size-4 text-primary" />
                Portfolio health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Invested vs cash</span>
                  <span className="tnum font-semibold">{investedRatio.toFixed(0)}% invested</span>
                </div>
                <Progress value={investedRatio} className="mt-2 h-2" />
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  {formatCompactMoney(summary.marketValue)} in the market · {formatCompactMoney(summary.cash)} in cash
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Largest position</span>
                  <span className="tnum font-semibold">{concentration.toFixed(1)}%</span>
                </div>
                <Progress
                  value={Math.min(concentration, 100)}
                  className="mt-2 h-2"
                  indicatorClassName={concentration > 35 ? "bg-warning" : "bg-gain"}
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  {topHolding && <StockAvatar symbol={topHolding.instrument.symbol} size="xs" />}
                  {topHolding ? topHolding.instrument.symbol : "—"}
                  {concentration > 35 && (
                    <Badge variant="warning" className="gap-1 text-[10px]">
                      <AlertTriangleIcon className="size-2.5" />
                      Concentrated
                    </Badge>
                  )}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <MiniMetric
                  label="Best performer"
                  value={bestHolding ? formatPercent(bestHolding.unrealizedPnlPct) : "—"}
                  symbol={bestHolding?.instrument.symbol}
                  tone="gain"
                />
                <MiniMetric
                  label="Weakest"
                  value={worstHolding ? formatPercent(worstHolding.unrealizedPnlPct) : "—"}
                  symbol={worstHolding?.instrument.symbol}
                  tone={worstHolding && worstHolding.unrealizedPnlPct >= 0 ? "gain" : "loss"}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------------- metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={LayersIcon}
          label="Invested cost basis"
          value={hydrated ? formatMoney(summary.invested) : undefined}
          hint={`${summary.positionCount} open positions`}
        />
        <StatCard
          icon={TrendingUpIcon}
          label="Market value"
          value={hydrated ? formatMoney(summary.marketValue) : undefined}
          hint={hydrated ? formatPercent(summary.unrealizedPnlPct) + " vs cost" : undefined}
          tone={summary.unrealizedPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard
          icon={PieChartIcon}
          label="Unrealised P&L"
          value={
            hydrated
              ? `${summary.unrealizedPnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(summary.unrealizedPnl))}`
              : undefined
          }
          hint="Open positions"
          tone={summary.unrealizedPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard
          icon={WalletIcon}
          label="Realised P&L"
          value={
            hydrated
              ? `${summary.realizedPnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(summary.realizedPnl))}`
              : undefined
          }
          hint="Closed positions to date"
          tone={summary.realizedPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard
          icon={PiggyBankIcon}
          label="Cash balance"
          value={hydrated ? formatMoney(summary.cash) : undefined}
          hint="Available buying power"
        />
      </div>

      {/* --------------------------------------------------------- holdings */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
          <div>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Every position, ranked by market value</CardDescription>
          </div>
          {hydrated && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="tnum">{formatShares(holdings.reduce((acc, h) => acc + h.qty, 0))}</span>
              total shares &amp; units
            </div>
          )}
        </CardHeader>

        {hydrated ? (
          <HoldingsTable holdings={holdings} onTrade={openTrade} emptyMessage="Your portfolio is empty" />
        ) : (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}
      </Card>

      {hydrated && holdings.length > 0 && (
        <p className="text-center text-[11.5px] text-muted-foreground">
          Values update on every simulated tick.{" "}
          <Link href="/app/activity" className="text-primary hover:underline">
            See the full activity log →
          </Link>
        </p>
      )}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  symbol,
  tone,
}: {
  label: string;
  value: string;
  symbol?: string;
  tone: "gain" | "loss";
}) {
  return (
    <div className="rounded-lg border bg-muted/25 p-2.5">
      <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn("tnum mt-0.5 text-[15px] font-semibold", tone === "gain" ? "text-gain" : "text-loss")}>{value}</p>
      {symbol && <p className="font-mono text-[11px] text-muted-foreground">{symbol}</p>}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof LayersIcon;
  label: string;
  value?: string;
  hint?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {value ? (
        <p className={cn("tnum mt-2 text-xl font-semibold tracking-tight", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
          {value}
        </p>
      ) : (
        <Skeleton className="mt-2.5 h-6 w-28" />
      )}
      {hint && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
