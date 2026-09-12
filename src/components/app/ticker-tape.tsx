"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon } from "lucide-react";

import { useMarket } from "@/components/market/market-provider";
import { formatPercent } from "@/lib/format";
import { CATALOG } from "@/lib/market/catalog";
import { cn } from "@/lib/utils";

function TapeItem({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  const { quote } = useMarket();
  const q = quote(symbol);
  const pct = q?.changePct ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 border-r border-border/60 px-3.5 py-2 text-[11.5px] transition-colors hover:bg-muted/70"
    >
      <span className="font-mono font-semibold tracking-tight">{symbol}</span>
      <span className="tnum text-muted-foreground">{q ? q.price.toFixed(2) : "—"}</span>
      <span className={cn("tnum font-semibold", pct >= 0 ? "text-gain" : "text-loss")}>{formatPercent(pct)}</span>
    </button>
  );
}

/**
 * Seamless scrolling price tape across the top of the app.
 * The list is rendered twice and translated −50% so the loop is invisible.
 */
export function TickerTape({ className }: { className?: string }) {
  const router = useRouter();
  const { ready, indices } = useMarket();
  const symbols = React.useMemo(() => CATALOG.map((instrument) => instrument.symbol), []);

  return (
    <div
      className={cn(
        "ticker-tape relative flex h-9 items-stretch overflow-hidden border-b border-sidebar-border bg-sidebar/60",
        className,
      )}
      aria-label="Live simulated prices"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />

      {!ready ? (
        <div className="flex items-center gap-6 px-4 text-[11.5px] text-muted-foreground">
          <span className="animate-pulse">Starting market simulator…</span>
        </div>
      ) : (
        <div className="flex w-max animate-ticker items-stretch">
          {[0, 1].map((pass) => (
            <div key={pass} className="flex items-stretch" aria-hidden={pass === 1}>
              {indices.map((index) => (
                <div
                  key={`${pass}-${index.symbol}`}
                  className="flex shrink-0 items-center gap-1.5 border-r border-border/60 bg-primary/6 px-3.5 py-2 text-[11.5px]"
                >
                  <span className="font-semibold">{index.symbol}</span>
                  <span className="tnum text-muted-foreground">
                    {index.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </span>
                  <span className={cn("tnum font-semibold", index.changePct >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(index.changePct)}
                  </span>
                </div>
              ))}
              {symbols.map((symbol) => (
                <TapeItem
                  key={`${pass}-${symbol}`}
                  symbol={symbol}
                  onClick={() => router.push(`/app/stock/${encodeURIComponent(symbol)}`)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/app/markets"
        className="absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground xl:flex"
      >
        All markets
        <ArrowUpRightIcon className="size-3" />
      </Link>
    </div>
  );
}
