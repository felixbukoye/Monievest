"use client";

import Link from "next/link";
import { ArrowUpRightIcon, PlusIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { useTrade } from "@/components/app/app-shell";
import { PriceChart } from "@/components/charts/price-chart";
import { useMarket } from "@/components/market/market-provider";
import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { Sparkline } from "@/components/shared/sparkline";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { CATALOG, getInstrument } from "@/lib/market/catalog";
import { usePortfolio } from "@/lib/store/provider";
import { cn } from "@/lib/utils";

export function WatchlistView() {
  const { state, hydrated, toggleWatchlist } = usePortfolio();
  const { quotes, ready } = useMarket();
  const { openTrade } = useTrade();

  const watched = state.watchlist
    .map((symbol) => getInstrument(symbol))
    .filter((instrument): instrument is NonNullable<typeof instrument> => Boolean(instrument));

  const suggestions = React.useMemo(
    () =>
      CATALOG.filter((instrument) => !state.watchlist.includes(instrument.symbol))
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, 6),
    [state.watchlist],
  );

  const totalDayChange = watched.reduce((acc, instrument) => {
    const quote = quotes[instrument.symbol];
    return acc + (quote?.changePct ?? instrument.changePct);
  }, 0);
  const averageChange = watched.length > 0 ? totalDayChange / watched.length : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Watchlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hydrated
              ? `${watched.length} instrument${watched.length === 1 ? "" : "s"} tracked${
                  watched.length > 0 ? ` · averaging ${formatPercent(averageChange)} today` : ""
                }`
              : "Loading watchlist…"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/markets">
            <SearchIcon />
            Find more instruments
          </Link>
        </Button>
      </div>

      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[16.5rem] w-full rounded-xl" />
          ))}
        </div>
      ) : watched.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StarIcon className="size-5" />}
            title="Your watchlist is empty"
            description="Star any instrument from the markets table, search results or a stock page and it will show up here with a live mini chart."
            action={
              <Button asChild variant="glow">
                <Link href="/app/markets">
                  <PlusIcon />
                  Browse markets
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {watched.map((instrument) => {
            const quote = quotes[instrument.symbol];
            const pct = quote?.changePct ?? instrument.changePct;
            const held = state.positions.find((position) => position.symbol === instrument.symbol);
            const low = quote?.dayLow ?? instrument.week52Low;
            const high = quote?.dayHigh ?? instrument.week52High;
            const price = quote?.price ?? instrument.price;
            const position = Math.min(Math.max(((price - low) / (high - low || 1)) * 100, 2), 98);

            return (
              <Card key={instrument.symbol} className="group overflow-hidden p-0 transition-all hover:border-primary/40">
                <CardHeader className="flex-row items-start justify-between gap-2 border-b p-4">
                  <Link href={`/app/stock/${instrument.symbol}`} className="flex min-w-0 items-center gap-2.5">
                    <StockAvatar symbol={instrument.symbol} size="sm" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[13.5px] font-semibold">{instrument.symbol}</span>
                        {held && (
                          <Badge variant="success" className="px-1 py-0 text-[9px]">
                            HELD
                          </Badge>
                        )}
                      </span>
                      <span className="block max-w-[11rem] truncate text-[11.5px] text-muted-foreground">
                        {instrument.name}
                      </span>
                    </span>
                  </Link>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-loss"
                    aria-label={`Remove ${instrument.symbol} from watchlist`}
                    onClick={() => toggleWatchlist(instrument.symbol)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </CardHeader>

                <CardContent className="p-4">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <LivePrice symbol={instrument.symbol} size="lg" />
                      <div className="mt-1">
                        <ChangeChip pct={pct} size="sm" />
                      </div>
                    </div>
                    <Sparkline
                      data={(quote?.intraday ?? []).slice(-50).map((point) => point.p)}
                      width={104}
                      height={40}
                    />
                  </div>

                  <div className="mt-4">
                    <div className="relative h-1.5 rounded-full bg-muted">
                      <span
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                        style={{ left: `${position}%` }}
                      />
                    </div>
                    <div className="tnum mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
                      <span>{formatMoney(low)}</span>
                      <span>Day range</span>
                      <span>{formatMoney(high)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Cap</p>
                      <p className="tnum text-[12px] font-semibold">{formatCompactMoney(instrument.marketCap)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">P/E</p>
                      <p className="tnum text-[12px] font-semibold">
                        {instrument.pe ? formatNumber(instrument.pe, 1) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Yield</p>
                      <p className="tnum text-[12px] font-semibold">
                        {instrument.dividendYield > 0 ? `${instrument.dividendYield.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-gain text-gain-foreground hover:bg-gain/90"
                      onClick={() => openTrade(instrument.symbol, "buy")}
                    >
                      <ArrowUpRightIcon />
                      Buy
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/app/stock/${instrument.symbol}`}>Research</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------- suggestions */}
      {hydrated && (
        <Card className="p-0">
          <CardHeader className="flex-row items-center justify-between gap-3 border-b p-4">
            <div>
              <CardTitle className="text-[15px]">Suggested for you</CardTitle>
              <p className="text-sm text-muted-foreground">Large, liquid names you aren’t tracking yet</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((instrument) => {
              const quote = quotes[instrument.symbol];
              const pct = quote?.changePct ?? instrument.changePct;
              return (
                <div
                  key={instrument.symbol}
                  className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3 transition-colors hover:border-primary/40"
                >
                  <StockAvatar symbol={instrument.symbol} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/stock/${instrument.symbol}`} className="font-mono text-[12.5px] font-semibold hover:underline">
                      {instrument.symbol}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">{instrument.name}</p>
                  </div>
                  {ready && <Sparkline data={(quote?.intraday ?? []).slice(-30).map((p) => p.p)} width={48} height={20} fill={false} />}
                  <span className={cn("tnum w-14 text-right text-[12px] font-semibold", pct >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(pct)}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Add ${instrument.symbol} to watchlist`}
                    onClick={() => toggleWatchlist(instrument.symbol)}
                  >
                    <StarIcon className="size-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {hydrated && watched.length > 0 && ready && (
        <Card className="p-0">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-[15px]">One-month view · {watched[0]!.symbol}</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <PriceChart
              instrument={watched[0]!}
              quote={quotes[watched[0]!.symbol]}
              range="1M"
              ready={ready}
              height={200}
              showVolume={false}
              color={watched[0]!.color}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
