"use client";

import Link from "next/link";
import * as React from "react";

import { useMarket } from "@/components/market/market-provider";
import { LivePrice } from "@/components/shared/prices";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/format";
import { getInstrument } from "@/lib/market/catalog";
import { usePortfolio } from "@/lib/store/provider";
import { periodChangePct } from "@/lib/store/selectors";
import { cn } from "@/lib/utils";

function RailCard({ symbol }: { symbol: string }) {
  const { quote, ready } = useMarket();
  const instrument = getInstrument(symbol);
  if (!instrument) return null;

  const q = quote(symbol);
  const monthPct = ready ? periodChangePct(instrument, q, "1M") : instrument.changePct;
  const up = monthPct >= 0;

  return (
    <Link
      href={`/app/stock/${instrument.symbol}`}
      className="card-soft group flex w-[212px] shrink-0 snap-start flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="flex items-center gap-3">
        <StockAvatar symbol={instrument.symbol} size="md" tone="solid" className="rounded-full" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold tracking-tight">{instrument.symbol}</span>
          <span className="block truncate text-[11.5px] text-muted-foreground">{instrument.name}</span>
        </span>
      </div>

      <div>
        <LivePrice symbol={instrument.symbol} size="lg" className="block" />
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px]">
          <span
            className={cn(
              "tnum inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold",
              up ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss",
            )}
          >
            <span aria-hidden="true">{up ? "↑" : "↓"}</span>
            {ready ? formatPercent(Math.abs(monthPct)) : "—"}
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </p>
      </div>
    </Link>
  );
}

/**
 * Horizontally scrolling row of stock cards, mirroring the reference design's
 * top rail. Shows what you already own first, then your watchlist.
 */
export function StockRail() {
  const { state, hydrated } = usePortfolio();
  const { ready } = useMarket();

  const symbols = React.useMemo(() => {
    const owned = state.positions.map((position) => position.symbol);
    const watched = state.watchlist.filter((symbol) => !owned.includes(symbol));
    return [...owned, ...watched].slice(0, 10);
  }, [state.positions, state.watchlist]);

  if (!hydrated || !ready) {
    return (
      <div className="scrollbar-none flex gap-4 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[136px] w-[212px] shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  if (symbols.length === 0) return null;

  return (
    <div
      className="scrollbar-none -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1"
      role="list"
      aria-label="Your stocks at a glance"
    >
      {symbols.map((symbol) => (
        <RailCard key={symbol} symbol={symbol} />
      ))}
    </div>
  );
}
